import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException
} from "@nestjs/common";
import {
  AdaptiveItemStage, AdaptiveMemberRole, AdaptiveMemberStatus,
  BookingOperationMode, BookingStatus, NotificationKind, Prisma
} from "@prisma/client";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { PrismaService } from "../database/prisma.service";
import { staffCoversSlot } from "./adaptive-roster-rules";
import { validateAdaptiveServicePolicy } from "./adaptive-service-policy";

const assignable: BookingStatus[] = [
  BookingStatus.ACCEPTED, BookingStatus.PAYMENT_PENDING,
  BookingStatus.FUNDED, BookingStatus.IN_PROGRESS
];
const intakeAllowed: BookingStatus[] = [
  BookingStatus.REQUESTED, ...assignable
];
type Data = Record<string, unknown>;
const transitions: Record<AdaptiveItemStage, AdaptiveItemStage[]> = {
  AWAITING_INTAKE: [AdaptiveItemStage.RECEIVED],
  RECEIVED: [AdaptiveItemStage.IN_PROGRESS],
  IN_PROGRESS: [AdaptiveItemStage.READY],
  READY: [AdaptiveItemStage.COLLECTED, AdaptiveItemStage.OUT_FOR_DELIVERY],
  OUT_FOR_DELIVERY: [AdaptiveItemStage.DELIVERED],
  DELIVERED: [],
  COLLECTED: []
};

@Injectable()
export class AdaptiveBookingOpsService {
  constructor(private readonly db: PrismaService) {}
  private obj(v: unknown): Data {
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw new BadRequestException("Expected a JSON object");
    return v as Data;
  }
  private id(v: unknown, key: string): string {
    if (typeof v !== "string" || v.trim().length < 3 || v.length > 140)
      throw new BadRequestException(key + " is invalid");
    return v.trim();
  }
  private rev(v: unknown): number {
    if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 1 || v > 10000000)
      throw new BadRequestException("expectedRevision must be a positive integer");
    return v;
  }
  private async actor(identity: AuthIdentity) {
    const user = await this.db.user.findUnique({ where: { authSubject: identity.subject }, select: { id: true } });
    if (!user) throw new NotFoundException("Hustle account not synchronized");
    return user;
  }
  private async access(userId: string, workspaceId: string, permission?: string) {
    const m = await this.db.adaptiveMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } }
    });
    if (!m || m.status !== AdaptiveMemberStatus.ACTIVE ||
      permission && m.role !== AdaptiveMemberRole.OWNER && !m.permissions.includes(permission))
      throw new ForbiddenException("No approved workspace permission");
  }
  private async booking(userId: string, bookingId: string, workspaceId: string) {
    const b = await this.db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true, clientUserId: true, hustlerUserId: true, status: true,
        agreedPriceMinor: true, confirmedStartAt: true, confirmedEndAt: true,
        requestedStartAt: true, requestedEndAt: true,
        service: { select: {
          id: true, bookingMode: true, bookingTimezone: true, defaultDurationMinutes: true,
          prepMinutes: true, bufferMinutes: true, resourcePoolKey: true,
          adaptiveDraft: { select: { workspaceId: true, policy: true, blueprint: { select: { slug: true } } } }
        } }
      }
    });
    if (!b || b.service.adaptiveDraft?.workspaceId !== workspaceId)
      throw new NotFoundException("Booking not found in this workspace");
    if (b.clientUserId !== userId && b.hustlerUserId !== userId)
      await this.access(userId, workspaceId);
    return b;
  }
  private async locked<T>(ownerId: string, work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(async tx => {
      // Exactly the same owner-wide advisory lock as canonical Booking acceptance.
      const locks = await tx.$queryRawUnsafe<{ acquired: boolean }[]>(
        "SELECT pg_try_advisory_xact_lock(hashtext($1),19477) AS acquired",ownerId);
      if (!locks[0]?.acquired)
        throw new ConflictException("Booking calendar is being updated. Retry shortly");
      return work(tx);
    });
  }
  async summary(identity: AuthIdentity, workspaceId: string, bookingId: string) {
    const user = await this.actor(identity);
    const b=await this.booking(user.id, this.id(bookingId,"bookingId"),workspaceId);
    const [assignment,fulfillment] = await Promise.all([
      this.db.adaptiveBookingAssignment.findUnique({
        where: { bookingId }, select: {
          id:true,revision:true,assignedAt:true,staffId:true,
          staff:{select:{displayName:true,active:true}}
        }
      }),
      this.db.adaptiveItemFulfillment.findUnique({
        where: { bookingId }, select: { id:true,revision:true,status:true,
          intakeMethod:true,returnMethod:true,policySnapshot:true,estimatedReadyAt:true,actualReadyAt:true,
          updatedAt:true }
      })
    ]);
    const itemPolicy = b.service.adaptiveDraft?.blueprint.slug === "item"
      ? validateAdaptiveServicePolicy("item",fulfillment?.policySnapshot ??
          b.service.adaptiveDraft.policy) : null;
    return { bookingId, assignment, fulfillment, bookingStatus:b.status,
      viewerRole:user.id===b.clientUserId?"CLIENT":user.id===b.hustlerUserId?"HUSTLER":"TEAM",
      offeredMethods:itemPolicy ? {
        handoverMethods:itemPolicy.handoverMethods,returnMethods:itemPolicy.returnMethods
      } : null };
  }
  async workspaceBookings(identity: AuthIdentity, workspaceId: string) {
    const user=await this.actor(identity);
    await this.access(user.id,workspaceId,"work.manage");
    const workspace=await this.db.adaptiveWorkspace.findUnique({
      where:{id:workspaceId},select:{ownerUserId:true}
    });
    if (!workspace)throw new NotFoundException("Workspace not found");
    return this.db.booking.findMany({
      where:{hustlerUserId:workspace.ownerUserId,
        service:{adaptiveDraft:{is:{workspaceId}}}},
      select:{id:true,serviceTitleSnapshot:true,status:true,confirmedStartAt:true,
        requestedStartAt:true,client:{select:{displayName:true,username:true}},
        service:{select:{bookingMode:true}},
        adaptiveAssignment:{select:{revision:true,staffId:true,
          staff:{select:{displayName:true}}}},
        adaptiveItemFulfillment:{select:{revision:true,status:true,intakeMethod:true,
          returnMethod:true,updatedAt:true}} },
      orderBy:{createdAt:"desc"},take:60
    });
  }
  async myBookingSummary(identity: AuthIdentity, bookingId: string) {
    const user=await this.actor(identity);
    const b=await this.db.booking.findUnique({where:{id:bookingId},
      select:{clientUserId:true,hustlerUserId:true,service:{select:{
        adaptiveDraft:{select:{workspaceId:true}}}}}});
    if(!b||(b.clientUserId!==user.id&&b.hustlerUserId!==user.id)||
      !b.service.adaptiveDraft)throw new NotFoundException("Item operations not available");
    return this.summary(identity,b.service.adaptiveDraft.workspaceId,bookingId);
  }
  async myHandover(identity: AuthIdentity, bookingId: string, input: unknown) {
    const user=await this.actor(identity);
    const b=await this.db.booking.findUnique({where:{id:bookingId},
      select:{clientUserId:true,service:{select:{adaptiveDraft:{select:{workspaceId:true}}}}}});
    if(!b||b.clientUserId!==user.id||!b.service.adaptiveDraft)
      throw new NotFoundException("Booking item options not found");
    return this.selectHandover(identity,b.service.adaptiveDraft.workspaceId,bookingId,input);
  }
  async assignments(identity: AuthIdentity, workspaceId: string) {
    const user=await this.actor(identity);
    await this.access(user.id,workspaceId);
    return this.db.adaptiveBookingAssignment.findMany({
      where: { workspaceId, booking: { status: { in: assignable } } },
      select: {
        id:true,bookingId:true,revision:true,
        staff:{select:{id:true,displayName:true,active:true}},
        booking:{select:{status:true,confirmedStartAt:true,confirmedEndAt:true,serviceTitleSnapshot:true}}
      }, orderBy:{assignedAt:"desc"},take:100
    });
  }
  async assign(identity: AuthIdentity, workspaceId: string, bookingId: string, raw: unknown) {
    const user=await this.actor(identity);
    await this.access(user.id,workspaceId,"schedule.manage");
    const input=this.obj(raw), staffId=this.id(input.staffId,"staffId");
    const expected=input.expectedRevision == null?null:this.rev(input.expectedRevision);
    const booking=await this.booking(user.id,bookingId,workspaceId);
    if (!assignable.includes(booking.status) ||
        booking.service.bookingMode!==BookingOperationMode.APPOINTMENT ||
        !booking.confirmedStartAt)
      throw new ConflictException("Assign staff only to accepted appointment bookings");
    const workspace=await this.db.adaptiveWorkspace.findUnique({where:{id:workspaceId},
      select:{rosterEnabled:true,ownerUserId:true,stationCapacity:true}});
    if (!workspace?.rosterEnabled || booking.hustlerUserId!==workspace.ownerUserId)
      throw new ConflictException("Verified business roster must be active");
    return this.locked(workspace.ownerUserId,async tx=>{
      const current=await tx.adaptiveBookingAssignment.findUnique({where:{bookingId}});
      if (current && current.staffId===staffId) return current; // idempotent
      if (current && expected!==current.revision)
        throw new ConflictException("Assignment has changed; refresh before reassigning");
      if (!current && expected!==null)
        throw new ConflictException("No existing assignment; refresh");
      const latest=await tx.booking.findUnique({where:{id:bookingId},
        select:{status:true,confirmedStartAt:true,confirmedEndAt:true}});
      if(!latest||!assignable.includes(latest.status)||!latest.confirmedStartAt)
        throw new ConflictException("Booking is no longer assignable");
      const start=new Date(latest.confirmedStartAt.getTime()-booking.service.prepMinutes*60000);
      const finish=new Date((latest.confirmedEndAt ?? new Date(latest.confirmedStartAt.getTime()+
        booking.service.defaultDurationMinutes*60000)).getTime()+booking.service.bufferMinutes*60000);
      const person=await tx.adaptiveStaffMember.findFirst({
        where:{id:staffId,workspaceId,active:true},
        include:{leave:{where:{cancelledAt:null}}}
      });
      if(!person||!staffCoversSlot(person,start,finish,booking.service.bookingTimezone))
        throw new ConflictException("Worker is off shift, on leave or inactive for this appointment");
      const other=await tx.adaptiveBookingAssignment.findMany({
        where:{staffId,bookingId:{not:bookingId},booking:{status:{in:assignable}}},
        include:{booking:{select:{confirmedStartAt:true,confirmedEndAt:true,
          service:{select:{prepMinutes:true,bufferMinutes:true,defaultDurationMinutes:true}}}}}
      });
      for(const row of other) {
        if(!row.booking.confirmedStartAt)continue;
        const a=row.booking.confirmedStartAt;
        const otherStart=new Date(a.getTime()-row.booking.service.prepMinutes*60000);
        const otherEnd=new Date((row.booking.confirmedEndAt ??
          new Date(a.getTime()+row.booking.service.defaultDurationMinutes*60000)).getTime()+
          row.booking.service.bufferMinutes*60000);
        if(otherStart<finish&&start<otherEnd)
          throw new ConflictException("Worker is already assigned to an overlapping appointment");
      }
      if(current) {
        const changed=await tx.adaptiveBookingAssignment.updateMany({
          where:{id:current.id,revision:current.revision},
          data:{staffId,revision:{increment:1},assignedAt:new Date()}
        });
        if(changed.count!==1)throw new ConflictException("Assignment changed");
      }else await tx.adaptiveBookingAssignment.create({data:{bookingId,workspaceId,staffId}});
      await tx.systemEvent.create({data:{
        name:current?"adaptive.worker_reassigned":"adaptive.worker_assigned",source:"adaptive",
        payload:{bookingId,workspaceId,staffId,previousStaffId:current?.staffId??null,actorUserId:user.id}
      }});
      return tx.adaptiveBookingAssignment.findUniqueOrThrow({
        where:{bookingId},select:{id:true,bookingId:true,staffId:true,revision:true}
      });
    });
  }
  async selectHandover(identity: AuthIdentity, workspaceId: string, bookingId: string, raw: unknown) {
    const user=await this.actor(identity),b=await this.booking(user.id,bookingId,workspaceId);
    if(user.id!==b.clientUserId)throw new ForbiddenException("Only the client selects pickup and return options");
    if(b.service.bookingMode!==BookingOperationMode.WORK_QUEUE ||
       b.service.adaptiveDraft?.blueprint.slug!=="item"||!intakeAllowed.includes(b.status))
      throw new ConflictException("Item options not available for this booking");
    const policy=validateAdaptiveServicePolicy("item",b.service.adaptiveDraft.policy);
    const d=this.obj(raw);
    if(typeof d.intakeMethod!=="string"||!(policy.handoverMethods as string[]).includes(d.intakeMethod)||
       typeof d.returnMethod!=="string"||!(policy.returnMethods as string[]).includes(d.returnMethod))
      throw new BadRequestException("Select handover and return methods offered by this business");
    // Existing options cannot silently change after the provider receives items.
    return this.db.$transaction(async tx=>{
      const prev=await tx.adaptiveItemFulfillment.findUnique({where:{bookingId}});
      if(prev&&prev.status!==AdaptiveItemStage.AWAITING_INTAKE)
        throw new ConflictException("Handover is already underway; contact the business to revise the agreement");
      if(prev){
        if(this.rev(d.expectedRevision)!==prev.revision)
          throw new ConflictException("Handover changed; refresh");
        return tx.adaptiveItemFulfillment.update({where:{id:prev.id},data:{
          intakeMethod:d.intakeMethod as string,returnMethod:d.returnMethod as string,
          policySnapshot:policy as Prisma.InputJsonValue,revision:{increment:1}
        }});
      }
      if(d.expectedRevision!==undefined)throw new ConflictException("Handover is not yet initialized");
      return tx.adaptiveItemFulfillment.create({data:{
        bookingId,workspaceId,intakeMethod:d.intakeMethod as string,returnMethod:d.returnMethod as string,
        policySnapshot:policy as Prisma.InputJsonValue
      }});
    });
  }
  async itemProgress(identity: AuthIdentity, workspaceId: string, bookingId: string, raw: unknown) {
    const user=await this.actor(identity);
    await this.access(user.id,workspaceId,"work.manage");
    const b=await this.booking(user.id,bookingId,workspaceId);
    if(b.hustlerUserId!== (await this.db.adaptiveWorkspace.findUnique({
      where:{id:workspaceId},select:{ownerUserId:true}
    }))?.ownerUserId)
      throw new ForbiddenException("Booking belongs to another professional");
    const d=this.obj(raw),version=this.rev(d.expectedRevision);
    if(typeof d.to!=="string"||!Object.values(AdaptiveItemStage).includes(d.to as AdaptiveItemStage))
      throw new BadRequestException("Unknown item workflow stage");
    const next=d.to as AdaptiveItemStage;
    return this.db.$transaction(async tx=>{
      const current=await tx.adaptiveItemFulfillment.findUnique({where:{bookingId}});
      if(!current||!transitions[current.status].includes(next))
        throw new ConflictException("This stage cannot follow the current item status");
      const latest=await tx.booking.findUnique({where:{id:bookingId},select:{status:true,agreedPriceMinor:true}});
      if(!latest||!assignable.includes(latest.status) ||
         latest.agreedPriceMinor>0&&!([BookingStatus.FUNDED,BookingStatus.IN_PROGRESS] as BookingStatus[]).includes(latest.status))
        throw new ConflictException("Paid item work requires confirmed funding before progress can advance");
      if(next===AdaptiveItemStage.OUT_FOR_DELIVERY&&
         !["home_delivery","courier"].includes(current.returnMethod))
        throw new ConflictException("Client selected collection, not delivery");
      if(next===AdaptiveItemStage.COLLECTED&&current.returnMethod!=="shop_pickup")
        throw new ConflictException("Client selected delivery, not shop collection");
      const changed=await tx.adaptiveItemFulfillment.updateMany({
        where:{id:current.id,revision:version,status:current.status},
        data:{status:next,revision:{increment:1},
          ...(next===AdaptiveItemStage.RECEIVED?{estimatedReadyAt:new Date(Date.now()+
            Number(validateAdaptiveServicePolicy("item",current.policySnapshot).turnaroundHours)*3600000)}:{}),
          ...(next===AdaptiveItemStage.READY?{actualReadyAt:new Date()}:{})}
      });
      if(changed.count!==1)throw new ConflictException("Item workflow changed; refresh");
      await tx.adaptiveItemEvent.create({data:{fulfillmentId:current.id,
        revision:version+1,eventType:"item."+next.toLowerCase(),actorUserId:user.id}});
      const notifyReady = b.service.adaptiveDraft?.blueprint.slug==="item" ?
        validateAdaptiveServicePolicy("item",current.policySnapshot).notifyWhenReady!==false : true;
      const notifyStages:AdaptiveItemStage[]=[AdaptiveItemStage.READY,AdaptiveItemStage.OUT_FOR_DELIVERY,
        AdaptiveItemStage.DELIVERED,AdaptiveItemStage.COLLECTED];
      if((next!==AdaptiveItemStage.READY || notifyReady) && notifyStages.includes(next)){
        const labels:Partial<Record<AdaptiveItemStage,[string,string]>>={
          READY:["Your item is ready","Your service provider has marked the work ready for pickup or delivery."],
          OUT_FOR_DELIVERY:["Your item is on its way","Your provider has marked your item out for delivery."],
          DELIVERED:["Item marked delivered","Your provider has marked delivery complete. Confirm details with them."],
          COLLECTED:["Item marked collected","Your provider has recorded collection of your item."]
        };
        const words=labels[next]!;
        await tx.notification.upsert({where:{recipientUserId_eventKey:{
          recipientUserId:b.clientUserId,eventKey:"adaptive:item:"+bookingId+":"+next+":"+String(version+1)
        }},update:{},create:{recipientUserId:b.clientUserId,
          eventKey:"adaptive:item:"+bookingId+":"+next+":"+String(version+1),
          kind:NotificationKind.BOOKING,title:words[0],body:words[1],href:"/bookings/"+bookingId
        }});
      }
      return tx.adaptiveItemFulfillment.findUniqueOrThrow({where:{id:current.id}});
    });
  }
}
