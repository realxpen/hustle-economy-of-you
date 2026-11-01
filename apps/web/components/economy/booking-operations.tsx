"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adaptiveClient, type AdaptiveWorkspaceBooking, type AdaptiveRoster, type AdaptiveItemStage, type AdaptiveStaffingAlerts } from "../../lib/adaptive";
import styles from "./booking-operations.module.css";

const statusActions:Partial<Record<AdaptiveItemStage,{next:AdaptiveItemStage;label:string}>>={
 AWAITING_INTAKE:{next:"RECEIVED",label:"Confirm item received"},
 RECEIVED:{next:"IN_PROGRESS",label:"Start work"},
 IN_PROGRESS:{next:"READY",label:"Mark ready and notify client"},
 READY:{next:"COLLECTED",label:"Record item collected"},
 OUT_FOR_DELIVERY:{next:"DELIVERED",label:"Record delivery"}
};
const stages:AdaptiveItemStage[]=["AWAITING_INTAKE","RECEIVED","IN_PROGRESS","READY","OUT_FOR_DELIVERY","DELIVERED","COLLECTED"];
const readable=(text:string)=>text.toLowerCase().replaceAll("_"," ");
const date=(value:string|null)=>value?new Date(value).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Lagos"}):"Not confirmed";
export function BookingOperations({workspaceId,canManageWork,canSchedule}:{workspaceId:string;canManageWork:boolean;canSchedule:boolean}){
 const [rows,setRows]=useState<AdaptiveWorkspaceBooking[]>([]);
 const [roster,setRoster]=useState<AdaptiveRoster|null>(null);
 const [alerts,setAlerts]=useState<AdaptiveStaffingAlerts|null>(null);
 const [selected,setSelected]=useState<Record<string,string>>({});
 const [selectedGroups,setSelectedGroups]=useState<Record<string,string[]>>({});
 const [etaInput,setEtaInput]=useState<Record<string,string>>({});
 const [etaReason,setEtaReason]=useState<Record<string,string>>({});
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
 async function moreAlerts(){
  if(busy||!alerts?.nextCursor)return;
  setBusy(true);setError("");
  try{
   const page=await adaptiveClient.staffingAlerts(workspaceId,alerts.nextCursor);
   setAlerts(previous=>({...page,items:[...(previous?.items??[]),...page.items]
    .filter((x,i,all)=>all.findIndex(y=>y.bookingId===x.bookingId)===i)}));
  }catch(e){setError(e instanceof Error?e.message:"Could not load the next appointments")}
  finally{setBusy(false)}
 }
 return <section className={styles.root} aria-label="Live business booking operations">
  <div className={styles.heading}><h2>Business bookings & fulfillment</h2><p>
   Assign eligible staff to accepted appointments. For laundry and tailoring, track work from intake to pickup or delivery without changing payment or escrow.</p></div>
  {error&&<p className={styles.error} role="alert">{error}</p>}
  {notice&&<p className={styles.notice} role="status">{notice}</p>}
  {alerts?.rosterEnabled&&<section className={styles.alerts} aria-label="Staffing conflicts requiring review">
    <strong>{alerts.items.length} appointment{alerts.items.length===1?"":"s"} need staffing attention</strong>
    <p className={styles.hint}>Review staff, chairs and business hours against overlapping reservations. These alerts do not cancel or reschedule bookings. Refresh after changing Team & hours.</p>
    {alerts.items.map(x=><div className={styles.alertItem} key={x.bookingId}>
      <span><b>{x.serviceTitle}</b> · {date(x.confirmedStartAt)} · {x.reason==="CAPACITY_CONFLICT"?"Reserved appointment no longer fits current capacity or hours":x.reason==="UNASSIGNED"?"Worker not assigned":x.reason==="GROUP_UNDERSTAFFED"?"Group needs more eligible workers":
       x.reason==="WORKER_INACTIVE"?"Assigned worker is inactive":"Assigned worker is unavailable during this appointment"}
      {x.staffName?" · "+x.staffName:""}
      {x.capacityConflict&&<small> · {x.capacityReason} · Current capacity: {x.capacity}</small>}</span>
      {rows.some(b=>b.id===x.bookingId)&&<a href={"#operation-"+x.bookingId}>Review assignment</a>}
      <Link href={"/bookings/"+x.bookingId}>Review booking</Link>
    </div>)}
    {!alerts.items.length&&<p>No conflicts found in the appointments reviewed so far.</p>}
    {alerts.nextCursor&&<button type="button" disabled={busy} onClick={()=>void moreAlerts()}>Check next 50 appointments</button>}
    <button type="button" disabled={busy} onClick={()=>void act(()=>Promise.resolve(),"Booking review refreshed.")}>Refresh review</button>
  </section>}
  {loading?<p>Loading business work…</p>:!rows.length?<p className={styles.hint}>
   Bookings for services prepared by this business will appear here. No real bookings have been created by this screen.</p>:rows.map(b=>{
   const appointment=b.service.bookingMode==="APPOINTMENT";
   const assigned=b.adaptiveAssignment;
   const job=b.adaptiveItemFulfillment;
   const chosen=selected[b.id]??assigned?.staffId??"";
   const group=b.adaptiveGroup;
   const picks=selectedGroups[b.id]??group?.assignments.map(x=>x.staffId)??[];
   const next=job&&statusActions[job.status];
   const possible=job?.status==="READY"&&job.returnMethod!=="shop_pickup"
    ? {next:"OUT_FOR_DELIVERY" as AdaptiveItemStage,label:"Mark out for delivery"} : next;
   const valid=["ACCEPTED","PAYMENT_PENDING","FUNDED","IN_PROGRESS"].includes(b.status);
   const canAdvance=canManageWork&&job&&valid&&(b.agreedPriceMinor===0||b.status==="FUNDED"||b.status==="IN_PROGRESS");
   return <article className={styles.card} key={b.id} id={"operation-"+b.id}>
    <div className={styles.top}><div><small>{appointment?"APPOINTMENT":"ITEM SERVICE"}</small>
     <h3>{b.serviceTitleSnapshot}</h3></div><span>{readable(b.status)}</span></div>
    <p className={styles.hint}>Client: {b.client.displayName||b.client.username||"Hustle client"} · {date(b.confirmedStartAt??b.requestedStartAt)}</p>
    <Link href={"/bookings/"+b.id}>Open canonical booking</Link>
    {appointment?<div className={styles.actions}>
     {group ? <section className={styles.groupAssign} aria-label="Workers for group booking">
       <strong>Group appointment · {group.peopleCount} people</strong>
       <p className={styles.hint}>One worker per person, at the same time. {group.assignments.length} currently assigned.</p>
       {canSchedule&&<div className={styles.groupChoices}>
        {roster?.staff.filter(w=>w.active).map(w=><label key={w.id}>
          <input type="checkbox" checked={picks.includes(w.id)} disabled={busy||!valid||!roster.rosterEnabled}
           onChange={e=>setSelectedGroups(prev=>({
            ...prev,[b.id]:e.target.checked?[...picks,w.id]:picks.filter(id=>id!==w.id)
           }))}/>
          {w.displayName}
        </label>)}
        <button type="button" disabled={busy||!valid||picks.length!==group.peopleCount||!roster?.rosterEnabled}
         onClick={()=>void act(()=>adaptiveClient.assignGroup(workspaceId,b.id,picks,group.revision),
           "Group workers assigned. Booking price, payment and escrow remain unchanged.")}>
          Save {group.peopleCount} assignments
        </button>
       </div>}
      </section> : <>
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
     </>}
     <p className={styles.hint}>Shifts, leave, overlapping appointments and booking capacity are checked on the server. This never automatically changes client charges or releases escrow.</p>
    </div>:<div className={styles.actions}>
     {!job?<p className={styles.hint}>The client must choose from this business's offered pickup and return methods before processing begins.</p>:<>
      <p><strong>Item stage:</strong> {readable(job.status)}</p>
      <p className={styles.hint}>Received via {readable(job.intakeMethod)} · Return via {readable(job.returnMethod)}</p>
      {job.estimatedReadyAt&&<p className={styles.hint}>Estimated ready: {date(job.estimatedReadyAt)}</p>}
      {["COLLECTED","DELIVERED"].includes(job.status)&&!job.clientConfirmedAt&&
       <p className={styles.hint}>Awaiting the customer's own receipt confirmation. Your delivery record does not confirm receipt on their behalf.</p>}
      {job.clientConfirmedAt&&<p className={styles.hint}><strong>Client acknowledged receipt:</strong> {date(job.clientConfirmedAt)}</p>}
      {canAdvance&&["RECEIVED","IN_PROGRESS"].includes(job.status)&&
       <form className={styles.etaEditor} onSubmit={e=>{
        e.preventDefault();
        const parsed=new Date(etaInput[b.id]??"");
        if(!Number.isFinite(parsed.getTime())){setError("Choose a valid new date and time.");return;}
        void act(()=>adaptiveClient.reviseItemEta(workspaceId,b.id,parsed.toISOString(),
           etaReason[b.id]??"",job.revision),"Updated estimate saved and the client notified.");
       }}>
        <strong>Change estimated ready time</strong>
        <label>New date and time
         <input type="datetime-local" value={etaInput[b.id]??""} disabled={busy} required
          onChange={e=>setEtaInput({...etaInput,[b.id]:e.target.value})}/>
        </label>
        <label>Reason for this update
         <input type="text" minLength={8} maxLength={180} disabled={busy} required
          placeholder="e.g. Material delivery delayed"
          value={etaReason[b.id]??""} onChange={e=>setEtaReason({...etaReason,[b.id]:e.target.value})}/>
        </label>
        <button disabled={busy||!(etaInput[b.id]??"")||(etaReason[b.id]??"").trim().length<8}
         type="submit">Save new estimate & notify client</button>
       </form>}
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
