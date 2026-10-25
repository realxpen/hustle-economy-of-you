#!/usr/bin/env node
"use strict";
require("reflect-metadata");
const assert=require("node:assert/strict");
const {BookingService}=require("../../apps/api/dist/booking/booking.service.js");
const {BookingStatus,BookingTimeProposalStatus,CapabilityStatus}=require("@prisma/client");
const date=ms=>new Date(Date.now()+ms);
const first=date(3*86400000), second=date(4*86400000);
function fixture(){
 const b={
  id:"booking-fixture",serviceId:"service-fixture",clientUserId:"client",hustlerUserId:"hustler",
  conversationId:null,status:BookingStatus.REQUESTED,
  requestedStartAt:first,requestedEndAt:date(3*86400000+3600000),
  confirmedStartAt:null,confirmedEndAt:null,agreedPriceMinor:20000000,
  currency:"NGN",pricingTypeSnapshot:"FIXED",serviceTitleSnapshot:"UX009 staging work",
  timeProposalId:null,timeProposalStatus:null,timeProposalStartAt:null,timeProposalEndAt:null,
  timeProposalCreatedAt:null,timeProposalRespondedAt:null,timeProposalNote:null,
  fundedAt:null,acceptedAt:null,client:{id:"client",displayName:"Client",emailVerified:true,phoneVerified:false},
  hustler:{id:"hustler",displayName:"Hustler",emailVerified:true,phoneVerified:false},
  service:{id:"service-fixture",status:"PUBLISHED"}
 };
 const notifications=[],events=[],capacity=[];
 const matches=(w)=>{
  if(w.id!==undefined&&w.id!==b.id)return false;
  if(w.status!==undefined&&w.status!==b.status)return false;
  if(w.clientUserId!==undefined&&w.clientUserId!==b.clientUserId)return false;
  if(w.timeProposalId!==undefined&&w.timeProposalId!==b.timeProposalId)return false;
  if(w.timeProposalStatus!==undefined&&w.timeProposalStatus!==b.timeProposalStatus)return false;
  if(w.OR!==undefined&&!w.OR.some(c=>c.timeProposalStatus===b.timeProposalStatus||
    (c.timeProposalStatus?.in||[]).includes(b.timeProposalStatus)))return false;
  return true;
 };
 const booking={
  findFirst:async({where})=>((where.OR||[]).some(r=>r.clientUserId===b.clientUserId||r.hustlerUserId===b.hustlerUserId) ? {...b} : null),
  findUnique:async()=>({...b}),
  update:async({data})=>{Object.assign(b,data);return {...b}},
  updateMany:async({where,data})=>{
    if(!matches(where))return {count:0};
    Object.assign(b,data);return {count:1};
  }
 };
 const prisma={
  user:{findUnique:async({where})=>({id:where.authSubject})},
  userCapability:{findUnique:async()=>({status:CapabilityStatus.ACTIVE})},
  booking,notification:{createMany:async({data})=>{notifications.push(...data)}},
  systemEvent:{create:async({data})=>{events.push(data)}},
  $queryRaw:async()=>[{id:b.id}],
  $transaction:async(cb)=>cb(prisma)
 };
 const schedule={
  checkAvailability:async()=>({available:true,reason:null}),
  reserveWithinTransaction:async(_tx,payload)=>{
    capacity.push(payload);return {endAt:payload.endAt};
  }
 };
 return {b,notifications,events,capacity,service:new BookingService(prisma,{recordBookingStatus:async()=>{}},schedule)};
}
const user=subject=>({subject});
const rejected=async(fn,kind)=>{await assert.rejects(fn,(err)=>err?.name===kind,kind)};
(async()=>{
 const x=fixture(),id=x.b.id;
 await rejected(()=>x.service.proposeTime(user("client"),id,{
  startAt:second.toISOString()}),"ForbiddenException");
 const before=x.b.requestedStartAt.toISOString();
 const proposed=await x.service.proposeTime(user("hustler"),id,{
  startAt:second.toISOString(),endAt:date(4*86400000+3600000).toISOString()});
 assert.equal(proposed.timeProposalStatus,BookingTimeProposalStatus.PENDING);
 assert.equal(x.b.requestedStartAt.toISOString(),before,"propose cannot change original request");
 assert.equal(x.b.status,BookingStatus.REQUESTED,"propose cannot accept a booking");
 assert.equal(x.notifications.length,1);
 assert.equal(x.notifications[0].recipientUserId,"client");
 await rejected(()=>x.service.accept(user("hustler"),id,{}),"ConflictException");
 await rejected(()=>x.service.respondTime(user("hustler"),id,{
  proposalId:proposed.timeProposalId,decision:"ACCEPT"}),"ForbiddenException");
 await rejected(()=>x.service.respondTime(user("client"),id,{
  proposalId:"wrong-stale-id",decision:"ACCEPT"}),"ConflictException");
 const agreed=await x.service.respondTime(user("client"),id,{
  proposalId:proposed.timeProposalId,decision:"ACCEPT"});
 assert.equal(agreed.timeProposalStatus,BookingTimeProposalStatus.ACCEPTED);
 assert.equal(x.b.status,BookingStatus.REQUESTED);
 assert.equal(x.b.requestedStartAt.toISOString(),second.toISOString());
 assert.equal(x.b.agreedPriceMinor,20000000,"schedule consent cannot change agreed money");
 assert.equal(x.notifications.at(-1).recipientUserId,"hustler");
 await rejected(()=>x.service.respondTime(user("client"),id,{
  proposalId:proposed.timeProposalId,decision:"ACCEPT"}),"ConflictException");
 const confirmed=await x.service.accept(user("hustler"),id,{
  confirmedStartAt:second.toISOString(),
  confirmedEndAt:date(4*86400000+3600000).toISOString()
 });
 assert.equal(confirmed.status,BookingStatus.PAYMENT_PENDING,
  "Hustler final acceptance is a separate action; paid job remains unfunded");
 assert.equal(x.capacity.length,1);
 assert.equal(x.notifications.filter(n=>n.title?.includes("time")).length,2);

 const y=fixture(),p=await y.service.proposeTime(user("hustler"),y.b.id,{
  startAt:second.toISOString()});
 const declined=await y.service.respondTime(user("client"),y.b.id,{
  proposalId:p.timeProposalId,decision:"DECLINE"});
 assert.equal(declined.timeProposalStatus,BookingTimeProposalStatus.DECLINED);
 assert.equal(y.b.requestedStartAt.toISOString(),before,"decline must keep original");
 assert.equal(y.b.status,BookingStatus.REQUESTED,"decline must not cancel booking");
 assert.equal(y.notifications.length,2);
 console.log("PASS: actual Nest booking propose/accept/decline role gates, stale replay, timestamps, notifications, separate paid approval and unchanged escrow");
})().catch(err=>{console.error(err);process.exitCode=1});
