import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import {AdaptiveMemberRole,AdaptiveMemberStatus,BookingOperationMode,BookingStatus,Prisma} from "@prisma/client";
import {PrismaService} from "../database/prisma.service";
import type {AuthIdentity} from "../infrastructure/auth/auth.port";
import {staffCoversSlot} from "./adaptive-roster-rules";
import {BookingScheduleService} from "../booking/booking-schedule.service";

const occupied:BookingStatus[]=[BookingStatus.ACCEPTED,BookingStatus.PAYMENT_PENDING,BookingStatus.FUNDED,BookingStatus.IN_PROGRESS];
@Injectable()
export class AdaptiveGroupService {
 constructor(private readonly db:PrismaService,private readonly schedule:BookingScheduleService){}
 private async user(identity:AuthIdentity){
  const u=await this.db.user.findUnique({where:{authSubject:identity.subject},select:{id:true}});
  if(!u)throw new ForbiddenException("Sign in with a Hustle account");return u.id;
 }
 private async manager(userId:string,workspaceId:string){
  const m=await this.db.adaptiveMembership.findUnique({where:{workspaceId_userId:{workspaceId,userId:userId}}});
  if(!m||m.status!==AdaptiveMemberStatus.ACTIVE||
     m.role!==AdaptiveMemberRole.OWNER&&!m.permissions.includes("schedule.manage"))
    throw new ForbiddenException("Scheduling permission required");
 }
 async publicOptions(serviceId:string){
  if(!serviceId||serviceId.length>140)return {available:false,maxPeople:1};
  const draft=await this.db.adaptiveServiceDraft.findUnique({where:{canonicalServiceId:serviceId},
    select:{workspace:{select:{rosterEnabled:true,stationCapacity:true,staff:{where:{active:true},select:{id:true}}}},
     canonicalService:{select:{status:true,bookingMode:true,parallelCapacity:true}}}});
  if(!draft||!draft.workspace.rosterEnabled||draft.canonicalService?.status!=="PUBLISHED"||
    draft.canonicalService.bookingMode!==BookingOperationMode.APPOINTMENT)
    return {available:false,maxPeople:1};
  const maxPeople=Math.min(12,draft.workspace.stationCapacity,draft.workspace.staff.length,
    draft.canonicalService.parallelCapacity);
  return {available:maxPeople>1,maxPeople};
 }
 async get(identity:AuthIdentity,bookingId:string){
  const userId=await this.user(identity);
  const b=await this.db.booking.findUnique({where:{id:bookingId},select:{clientUserId:true,hustlerUserId:true}});
  if(!b)throw new NotFoundException("Booking not found");
  const group=await this.db.adaptiveGroupBooking.findUnique({where:{bookingId},
    include:{assignments:{include:{staff:{select:{id:true,displayName:true,active:true}}}}}});
  if(userId!==b.clientUserId&&userId!==b.hustlerUserId){
    if(!group)throw new NotFoundException("Group booking not found");
    await this.manager(userId,group.workspaceId);
  }
  return {group:group?{peopleCount:group.peopleCount,revision:group.revision,workspaceId:group.workspaceId,
    assignments:group.assignments.map(x=>({staffId:x.staffId,displayName:x.staff.displayName,active:x.staff.active}))}:null};
 }
 async assign(identity:AuthIdentity,workspaceId:string,bookingId:string,raw:unknown){
  const userId=await this.user(identity);await this.manager(userId,workspaceId);
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new BadRequestException("Invalid assignment request");
  const input=raw as {staffIds?:unknown;expectedRevision?:unknown};
  if(!Array.isArray(input.staffIds)||!input.staffIds.every(x=>typeof x==="string"&&x.length>3))
    throw new BadRequestException("Choose different workers for the group");
  const ids=input.staffIds as string[];
  if(new Set(ids).size!==ids.length)throw new BadRequestException("Each worker can occupy only one place");
  if(typeof input.expectedRevision!=="number"||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1)
    throw new BadRequestException("Expected assignment revision required");
  const workspace=await this.db.adaptiveWorkspace.findUnique({where:{id:workspaceId},
    select:{ownerUserId:true,rosterEnabled:true}});
  if(!workspace?.rosterEnabled)throw new ConflictException("Enable staff rosters for group bookings");
  return this.db.$transaction(async tx=>{
    const locks=await tx.$queryRawUnsafe<{acquired:boolean}[]>(
      "SELECT pg_try_advisory_xact_lock(hashtext($1),19477) AS acquired",workspace.ownerUserId);
    if(!locks[0]?.acquired)throw new ConflictException("Booking calendar is busy; retry");
    const group=await tx.adaptiveGroupBooking.findUnique({where:{bookingId},include:{assignments:true}});
    const b=await tx.booking.findUnique({where:{id:bookingId},select:{
      hustlerUserId:true,status:true,confirmedStartAt:true,confirmedEndAt:true,serviceId:true,
      service:{select:{bookingMode:true,bookingTimezone:true,prepMinutes:true,bufferMinutes:true,
        defaultDurationMinutes:true,adaptiveDraft:{select:{workspaceId:true}}}}
    }});
    if(!group||group.workspaceId!==workspaceId||!b||b.hustlerUserId!==workspace.ownerUserId||
      b.service.adaptiveDraft?.workspaceId!==workspaceId||
      b.service.bookingMode!==BookingOperationMode.APPOINTMENT||
      !occupied.includes(b.status)||!b.confirmedStartAt)
      throw new ConflictException("This is not an accepted group appointment");
    if(ids.length!==group.peopleCount)
      throw new BadRequestException("Group booking requires exactly "+group.peopleCount+" distinct workers");
    const old=group.assignments.map(x=>x.staffId).sort();
    const sorted=[...ids].sort();
    if(old.length===sorted.length&&old.every((x,i)=>x===sorted[i]))
      return {peopleCount:group.peopleCount,revision:group.revision,staffIds:old};
    if(group.revision!==input.expectedRevision)
      throw new ConflictException("Group staff assignments changed; refresh");
    const check=await this.schedule.reviewReservation(tx,{
      id:bookingId,serviceId:b.serviceId,confirmedStartAt:b.confirmedStartAt,confirmedEndAt:b.confirmedEndAt
    });
    if(!check.available)throw new ConflictException(check.reason??"Group resource pool is over capacity");
    const start=new Date(b.confirmedStartAt.getTime()-b.service.prepMinutes*60000);
    const end=new Date((b.confirmedEndAt??new Date(b.confirmedStartAt.getTime()+
      b.service.defaultDurationMinutes*60000)).getTime()+b.service.bufferMinutes*60000);
    const staff=await tx.adaptiveStaffMember.findMany({where:{workspaceId,id:{in:ids},active:true},
      include:{leave:{where:{cancelledAt:null}}}});
    if(staff.length!==ids.length||!staff.every(p=>staffCoversSlot(p,start,end,b.service.bookingTimezone)))
      throw new ConflictException("At least one worker is off shift, on leave or inactive");
    const singles=await tx.adaptiveBookingAssignment.findMany({
      where:{staffId:{in:ids},bookingId:{not:bookingId},booking:{status:{in:occupied}}},
      include:{booking:{select:{confirmedStartAt:true,confirmedEndAt:true,service:{
        select:{prepMinutes:true,bufferMinutes:true,defaultDurationMinutes:true}}}}}
    });
    const groups=await tx.adaptiveGroupStaffAssignment.findMany({
      where:{staffId:{in:ids},group:{bookingId:{not:bookingId},booking:{status:{in:occupied}}}},
      include:{group:{include:{booking:{select:{confirmedStartAt:true,confirmedEndAt:true,service:{
        select:{prepMinutes:true,bufferMinutes:true,defaultDurationMinutes:true}}}}}}}
    });
    const conflictBookings=[
      ...singles.map(x=>x.booking),...groups.map(x=>x.group.booking)
    ];
    for(const other of conflictBookings){
      const t=other.confirmedStartAt;if(!t)continue;
      const a=new Date(t.getTime()-other.service.prepMinutes*60000);
      const z=new Date((other.confirmedEndAt??new Date(t.getTime()+
        other.service.defaultDurationMinutes*60000)).getTime()+other.service.bufferMinutes*60000);
      if(a<end&&start<z)throw new ConflictException("Worker has an overlapping assignment");
    }
    await tx.adaptiveGroupStaffAssignment.deleteMany({where:{groupId:group.id}});
    await tx.adaptiveGroupStaffAssignment.createMany({data:ids.map(staffId=>({groupId:group.id,staffId}))});
    const changed=await tx.adaptiveGroupBooking.updateMany({where:{id:group.id,revision:group.revision},
      data:{revision:{increment:1}}});
    if(changed.count!==1)throw new ConflictException("Group assignments changed");
    await tx.systemEvent.create({data:{name:"adaptive.group_staff_assigned",source:"adaptive",
      payload:{bookingId,workspaceId,peopleCount:group.peopleCount,staffIds:ids,actorUserId:userId}}});
    return {peopleCount:group.peopleCount,revision:group.revision+1,staffIds:ids};
  });
 }
}
