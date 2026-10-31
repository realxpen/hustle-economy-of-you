import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AdaptiveMemberRole, AdaptiveMemberStatus, BookingStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { validateWeeklyShifts } from "./adaptive-roster-rules";

@Injectable()
export class AdaptiveRosterService {
 constructor(private readonly db:PrismaService){}
 private async access(identity:AuthIdentity,spaceId:string,write=false){
  const user=await this.db.user.findUnique({where:{authSubject:identity.subject},select:{id:true}});
  if(!user)throw new ForbiddenException("Sign in with an existing Hustle account");
  const space=await this.db.adaptiveWorkspace.findUnique({where:{id:spaceId},select:{id:true,ownerUserId:true,stationCapacity:true,rosterEnabled:true}});
  if(!space)throw new NotFoundException("Workspace not found");
  const member=await this.db.adaptiveMembership.findUnique({where:{workspaceId_userId:{workspaceId:spaceId,userId:user.id}}});
  if(!member||member.status!==AdaptiveMemberStatus.ACTIVE||
     write&&(member.role!==AdaptiveMemberRole.OWNER&&!member.permissions.includes("schedule.manage")))
    throw new ForbiddenException("Active workspace scheduling permission required");
  return {user,space};
 }
 private object(input:unknown):Record<string,unknown>{
  if(!input||typeof input!=="object"||Array.isArray(input))throw new BadRequestException("Expected object");
  return input as Record<string,unknown>;
 }
 private shifts(value:unknown){
  try{return validateWeeklyShifts(value)}catch(e){throw new BadRequestException(e instanceof Error?e.message:"Invalid shifts")}
 }
 private name(value:unknown){
  if(typeof value!=="string"||value.trim().length<2||value.trim().length>80)throw new BadRequestException("Staff display name must be 2–80 characters");
  return value.trim();
 }
 private int(value:unknown,min:number,max:number,label:string){
  if(typeof value!=="number"||!Number.isSafeInteger(value)||value<min||value>max)throw new BadRequestException(label+" must be between "+min+" and "+max);
  return value;
 }
 private async locked<T>(ownerId:string,run:(tx:Prisma.TransactionClient)=>Promise<T>){
  return this.db.$transaction(async tx=>{
   const locks=await tx.$queryRawUnsafe<{acquired:boolean}[]>(
    "SELECT pg_try_advisory_xact_lock(hashtext($1),19477) AS acquired",ownerId);
   if(!locks[0]?.acquired)throw new ConflictException("Booking calendar is being updated. Retry.");
   return run(tx);
  });
 }
 private async warnings(tx:Prisma.TransactionClient,spaceId:string,ownerId:string){
  return tx.booking.count({where:{hustlerUserId:ownerId,
   status:{in:[BookingStatus.ACCEPTED,BookingStatus.PAYMENT_PENDING,BookingStatus.FUNDED,BookingStatus.IN_PROGRESS]},
   confirmedStartAt:{gte:new Date()},service:{resourcePoolKey:spaceId}}});
 }
 async list(identity:AuthIdentity,spaceId:string){
  const {space}=await this.access(identity,spaceId);
  const staff=await this.db.adaptiveStaffMember.findMany({where:{workspaceId:spaceId},
   include:{leave:{where:{cancelledAt:null},orderBy:{startAt:"asc"}}},orderBy:{createdAt:"asc"}});
  return {stationCapacity:space.stationCapacity,rosterEnabled:space.rosterEnabled,
   staff,activeStaff:staff.filter(s=>s.active).length,
   warning:"Roster changes affect new requests only. Existing accepted bookings require manual review if staffing decreases."};
 }
 async create(identity:AuthIdentity,spaceId:string,raw:unknown){
  const {space}=await this.access(identity,spaceId,true),d=this.object(raw);
  const displayName=this.name(d.displayName),weeklyHours=this.shifts(d.weeklyHours);
  return this.locked(space.ownerUserId,async tx=>{
   const staff=await tx.adaptiveStaffMember.create({data:{workspaceId:spaceId,displayName,weeklyHours:weeklyHours as unknown as Prisma.InputJsonValue}});
   return {staff,affectedExistingBookings:await this.warnings(tx,spaceId,space.ownerUserId)};
  });
 }
 async update(identity:AuthIdentity,spaceId:string,staffId:string,raw:unknown){
  const {space}=await this.access(identity,spaceId,true),d=this.object(raw);
  const displayName=this.name(d.displayName),weeklyHours=this.shifts(d.weeklyHours);
  const expectedRevision=this.int(d.expectedRevision,1,10000000,"Expected revision");
  if(typeof d.active!=="boolean")throw new BadRequestException("active must be true or false");
  return this.locked(space.ownerUserId,async tx=>{
   const changed=await tx.adaptiveStaffMember.updateMany({
    where:{id:staffId,workspaceId:spaceId,revision:expectedRevision},
    data:{displayName,weeklyHours:weeklyHours as unknown as Prisma.InputJsonValue,active:d.active as boolean,revision:{increment:1}}});
   if(changed.count!==1)throw new ConflictException("Staff roster changed. Refresh and retry.");
   const staff=await tx.adaptiveStaffMember.findUniqueOrThrow({where:{id:staffId}});
   return {staff,affectedExistingBookings:await this.warnings(tx,spaceId,space.ownerUserId)};
  });
 }
 async settings(identity:AuthIdentity,spaceId:string,raw:unknown){
  const {space}=await this.access(identity,spaceId,true),d=this.object(raw);
  const stationCapacity=this.int(d.stationCapacity,1,200,"Station count");
  if(typeof d.rosterEnabled!=="boolean")throw new BadRequestException("rosterEnabled must be boolean");
  return this.locked(space.ownerUserId,async tx=>{
   if(d.rosterEnabled){
    const active=await tx.adaptiveStaffMember.findMany({where:{workspaceId:spaceId,active:true},select:{weeklyHours:true}});
    if(!active.some(s=>Array.isArray(s.weeklyHours)&&s.weeklyHours.length>0))
     throw new BadRequestException("Add an active worker with shifts before enabling roster capacity");
   }
   const workspace=await tx.adaptiveWorkspace.update({where:{id:spaceId},data:{stationCapacity,rosterEnabled:d.rosterEnabled as boolean}});
   return {stationCapacity:workspace.stationCapacity,rosterEnabled:workspace.rosterEnabled,
    affectedExistingBookings:await this.warnings(tx,spaceId,space.ownerUserId)};
  });
 }
 async leave(identity:AuthIdentity,spaceId:string,staffId:string,raw:unknown){
  const {space}=await this.access(identity,spaceId,true),d=this.object(raw);
  if(typeof d.startAt!=="string"||typeof d.endAt!=="string"||
      !/([zZ]|[+-]\d\d:\d\d)$/.test(d.startAt)||!/([zZ]|[+-]\d\d:\d\d)$/.test(d.endAt))
   throw new BadRequestException("Leave dates need an explicit timezone offset");
  const startAt=new Date(d.startAt),endAt=new Date(d.endAt);
  if(!Number.isFinite(startAt.getTime())||!Number.isFinite(endAt.getTime())||
     endAt<=startAt||endAt.getTime()-startAt.getTime()>366*86400000)
   throw new BadRequestException("Leave dates must be a valid positive interval no longer than 366 days");
  const note=d.note==null?null:(typeof d.note==="string"&&d.note.length<=180?d.note:null);
  return this.locked(space.ownerUserId,async tx=>{
   const staff=await tx.adaptiveStaffMember.findFirst({where:{id:staffId,workspaceId:spaceId},select:{id:true}});
   if(!staff)throw new NotFoundException("Staff member not found in this workspace");
   const leave=await tx.adaptiveStaffLeave.create({data:{staffId,startAt,endAt,note}});
   return {leave,affectedExistingBookings:await this.warnings(tx,spaceId,space.ownerUserId)};
  });
 }
 async cancelLeave(identity:AuthIdentity,spaceId:string,staffId:string,leaveId:string){
  const {space}=await this.access(identity,spaceId,true);
  return this.locked(space.ownerUserId,async tx=>{
   const staff=await tx.adaptiveStaffMember.findFirst({where:{id:staffId,workspaceId:spaceId},select:{id:true}});
   if(!staff)throw new NotFoundException("Staff member not in this workspace");
   const change=await tx.adaptiveStaffLeave.updateMany({where:{id:leaveId,staffId,cancelledAt:null},data:{cancelledAt:new Date()}});
   if(change.count!==1)throw new ConflictException("Leave already cancelled or unavailable");
   return {cancelled:true,affectedExistingBookings:await this.warnings(tx,spaceId,space.ownerUserId)};
  });
 }
}
