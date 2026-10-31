"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adaptiveClient, type AdaptiveWorkspaceBooking, type AdaptiveRoster, type AdaptiveItemStage, type AdaptiveStaffingAlerts } from "../../lib/adaptive";
import styles from "./booking-operations.module.css";

const statusActions:Partial<Record<AdaptiveItemStage,{next:AdaptiveItemStage;label:string}>>={
 AWAITING_INTAKE:{next:"RECEIVED",label:"Confirm item received"},
 RECEIVED:{next:"IN_PROGRESS",label:"Start work"},
 IN_PROGRESS:{next:"READY",label:"Mark ready and notify client"},
 READY:{next:"COLLECTED",label:"Confirm client collected"},
 OUT_FOR_DELIVERY:{next:"DELIVERED",label:"Confirm delivery"}
};
const stages:AdaptiveItemStage[]=["AWAITING_INTAKE","RECEIVED","IN_PROGRESS","READY","OUT_FOR_DELIVERY","DELIVERED","COLLECTED"];
const readable=(text:string)=>text.toLowerCase().replaceAll("_"," ");
const date=(value:string|null)=>value?new Date(value).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Lagos"}):"Not confirmed";
export function BookingOperations({workspaceId,canManageWork,canSchedule}:{workspaceId:string;canManageWork:boolean;canSchedule:boolean}){
 const [rows,setRows]=useState<AdaptiveWorkspaceBooking[]>([]);
 const [roster,setRoster]=useState<AdaptiveRoster|null>(null);
 const [alerts,setAlerts]=useState<AdaptiveStaffingAlerts|null>(null);
 const [selected,setSelected]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
  const [data,staff,reviews]=await Promise.all([
   adaptiveClient.workspaceBookings(workspaceId),adaptiveClient.roster(workspaceId),
   canSchedule?adaptiveClient.staffingAlerts(workspaceId):Promise.resolve(null)
  ]);
  setRows(data);setRoster(staff);setAlerts(reviews);
 },[workspaceId,canSchedule]);
 useEffect(()=>{
  let alive=true;
  setLoading(true);setError("");setRows([]);setRoster(null);setAlerts(null);
  void Promise.all([
   adaptiveClient.workspaceBookings(workspaceId),adaptiveClient.roster(workspaceId),
   canSchedule?adaptiveClient.staffingAlerts(workspaceId):Promise.resolve(null)
  ])
   .then(([data,staff,reviews])=>{if(alive){setRows(data);setRoster(staff);setAlerts(reviews)}})
   .catch(e=>{if(alive)setError(e instanceof Error?e.message:"Could not load operational bookings")})
   .finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[workspaceId,canSchedule]);
 async function act(action:()=>Promise<unknown>,success:string){
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{await action();await load();setNotice(success)}
  catch(e){setError(e instanceof Error?e.message:"Action could not be completed. Refresh the booking.")}
  finally{setBusy(false)}
 }
 return <section className={styles.root} aria-label="Live business booking operations">
  <div className={styles.heading}><h2>Business bookings & fulfillment</h2><p>
   Assign eligible staff to accepted appointments. For laundry and tailoring, track work from intake to pickup or delivery without changing payment or escrow.</p></div>
  {error&&<p className={styles.error} role="alert">{error}</p>}
  {notice&&<p className={styles.notice} role="status">{notice}</p>}
  {!!alerts?.items.length&&<section className={styles.alerts} aria-label="Staffing conflicts requiring review">
    <strong>{alerts.items.length} appointment{alerts.items.length===1?"":"s"} need staffing attention</strong>
    <p className={styles.hint}>A worker left, changed shifts, is on leave, or has not yet been assigned. Review each confirmed booking. Nothing is cancelled or refunded automatically.</p>
    {alerts.items.map(x=><div className={styles.alertItem} key={x.bookingId}>
      <span><b>{x.serviceTitle}</b> · {date(x.confirmedStartAt)} · {x.reason==="UNASSIGNED"?"Worker not assigned":
       x.reason==="WORKER_INACTIVE"?"Assigned worker is inactive":"Assigned worker is unavailable during this appointment"}
      {x.staffName?" · "+x.staffName:""}</span>
      <a href={"#operation-"+x.bookingId}>Review assignment</a>
    </div>)}
    {alerts.limited&&<p className={styles.hint}>Showing the first 200 upcoming bookings. Review the full booking list for others.</p>}
  </section>}
  {loading?<p>Loading business work…</p>:!rows.length?<p className={styles.hint}>
   Bookings for services prepared by this business will appear here. No real bookings have been created by this screen.</p>:rows.map(b=>{
   const appointment=b.service.bookingMode==="APPOINTMENT";
   const assigned=b.adaptiveAssignment;
   const job=b.adaptiveItemFulfillment;
   const chosen=selected[b.id]??assigned?.staffId??"";
   const next=job&&statusActions[job.status];
   const possible=job?.status==="READY"&&job.returnMethod!=="shop_pickup"
    ? {next:"OUT_FOR_DELIVERY" as AdaptiveItemStage,label:"Mark out for delivery"} : next;
   const valid=["ACCEPTED","PAYMENT_PENDING","FUNDED","IN_PROGRESS"].includes(b.status);
   const canAdvance=canManageWork&&job&&(b.status==="FUNDED"||b.status==="IN_PROGRESS");
   return <article className={styles.card} key={b.id} id={"operation-"+b.id}>
    <div className={styles.top}><div><small>{appointment?"APPOINTMENT":"ITEM SERVICE"}</small>
     <h3>{b.serviceTitleSnapshot}</h3></div><span>{readable(b.status)}</span></div>
    <p className={styles.hint}>Client: {b.client.displayName||b.client.username||"Hustle client"} · {date(b.confirmedStartAt??b.requestedStartAt)}</p>
    <Link href={"/bookings/"+b.id}>Open canonical booking</Link>
    {appointment?<div className={styles.actions}>
     <small>Assigned worker: {assigned?.staff.displayName??"Not assigned"}</small>
     {canSchedule&&<div className={styles.selectRow}>
      <select aria-label={"Assign worker for "+b.serviceTitleSnapshot} value={chosen}
       onChange={e=>setSelected({...selected,[b.id]:e.target.value})} disabled={busy||!valid||!roster?.rosterEnabled}>
       <option value="">Choose available worker</option>
       {roster?.staff.filter(x=>x.active).map(x=><option key={x.id} value={x.id}>{x.displayName}</option>)}
      </select>
      <button disabled={busy||!valid||!chosen||!roster?.rosterEnabled} type="button"
       onClick={()=>void act(()=>adaptiveClient.assignWorker(workspaceId,b.id,chosen,assigned?.revision),
        "Worker assignment saved. Existing booking payment status is unchanged.")}>
       {assigned?"Reassign":"Assign"}
      </button>
     </div>}
     <p className={styles.hint}>Shift, leave and overlapping appointments are checked on the server. No automatic reassignment or client charge occurs.</p>
    </div>:<div className={styles.actions}>
     {!job?<p className={styles.hint}>The client must choose from this business's offered pickup and return methods before processing begins.</p>:<>
      <p><strong>Item stage:</strong> {readable(job.status)}</p>
      <p className={styles.hint}>Received via {readable(job.intakeMethod)} · Return via {readable(job.returnMethod)}</p>
      <div className={styles.stage}>{stages.filter(x=>x!=="DELIVERED"&&x!=="COLLECTED").map(x=>
       <span key={x} className={x===job.status?styles.active:""}>{readable(x)}</span>)}</div>
      {canAdvance&&possible&&<button disabled={busy} type="button" onClick={()=>void act(
       ()=>adaptiveClient.advanceItem(workspaceId,b.id,possible.next,job.revision),
       possible.next==="READY"?"Work marked ready. In-app notification created if enabled.":"Item progress updated.")}>{possible.label}</button>}
      {job.status==="READY"&&job.returnMethod==="shop_pickup"&&
       <small>Confirm collection only after the customer receives their item.</small>}
      {job.status==="READY"&&job.returnMethod!=="shop_pickup"&&
       <small>Mark out for delivery only after dispatch has started.</small>}
      {!canAdvance&&<small>Advancing paid work requires an actual funded or in-progress canonical booking.</small>}
     </>}
    </div>}
   </article>
  })}
 </section>;
}
