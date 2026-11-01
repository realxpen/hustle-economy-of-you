"use client";
import { useEffect, useState, type FormEvent } from "react";
import { adaptiveClient, type AdaptiveBookingOperation } from "../../lib/adaptive";
import styles from "./client-item-handover.module.css";
import { ItemDeliveryCase } from "./item-delivery-case";

const labels:Record<string,string>={
 drop_off:"Bring items to the business",home_pickup:"Have the business collect from my address",
 courier:"Arrange courier collection",shop_pickup:"I'll collect from the business",
 home_delivery:"Deliver to my address"
};
const stageLabels:Record<string,string>={
 AWAITING_INTAKE:"Awaiting item handover",RECEIVED:"Items received",
 IN_PROGRESS:"Being worked on",READY:"Ready for collection or delivery",
 OUT_FOR_DELIVERY:"Out for delivery",DELIVERED:"Marked delivered",COLLECTED:"Marked collected"
};
export function ClientItemHandover({bookingId,viewerRole}:{bookingId:string;viewerRole:string}){
 const [state,setState]=useState<AdaptiveBookingOperation|null>(null);
 const [intake,setIntake]=useState("");
 const [returnVia,setReturnVia]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [hidden,setHidden]=useState(false);
 const [notice,setNotice]=useState("");
 useEffect(()=>{
  let alive=true;
  setState(null);setHidden(false);setError("");
  void adaptiveClient.bookingOps(bookingId).then(x=>{
   if(!alive)return;
   if(!x.offeredMethods){setHidden(true);return;}
   setState(x);
   setIntake(x.fulfillment?.intakeMethod??x.offeredMethods.handoverMethods[0]??"");
   setReturnVia(x.fulfillment?.returnMethod??x.offeredMethods.returnMethods[0]??"");
  }).catch(()=>{if(alive)setHidden(true)});
  return()=>{alive=false};
 },[bookingId]);
 async function acknowledge(){
  if(busy||!state?.fulfillment)return;
  setBusy(true);setError("");setNotice("");
  try{
   await adaptiveClient.confirmItemReceipt(bookingId,state.fulfillment.revision);
   const updated=await adaptiveClient.bookingOps(bookingId);
   setState(updated);
   setNotice("Physical receipt recorded. Booking payment and escrow remain unchanged.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to confirm receipt. Refresh and retry.")}
  finally{setBusy(false)}
 }
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||!state)return;
  setBusy(true);setError("");setNotice("");
  try{
   await adaptiveClient.chooseHandover(bookingId,intake,returnVia,state.fulfillment?.revision);
   const refreshed=await adaptiveClient.bookingOps(bookingId);
   setState(refreshed);setNotice("Your handover choices have been saved with this booking.");
  }catch(e){setError(e instanceof Error?e.message:"Could not save handover preferences")}
  finally{setBusy(false)}
 }
 if(hidden||!state)return null;
 const job=state.fulfillment;
 return <section className={styles.root} aria-label="Item pickup and delivery">
  <div className={styles.head}><small>ITEM SERVICE JOURNEY</small><h2>Collection & handover</h2></div>
  <p className={styles.hint}>Choose how your items reach the business and how you receive them when finished. These choices do not add a payment or guarantee a delivery time.</p>
  {job&&<div className={styles.stage} role="status">
   <strong>{stageLabels[job.status]??job.status}</strong>
   <span>{job.actualReadyAt?"Marked ready: "+new Date(job.actualReadyAt).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"}):
    job.estimatedReadyAt?"Estimated ready: "+new Date(job.estimatedReadyAt).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"}):
    "Awaiting provider's estimated completion time"}</span>
  </div>}
  {job?.events?.[0]?.details?.reason&&<p className={styles.hint}>
   <strong>Updated completion estimate:</strong> {job.events[0].details.reason}
  </p>}
  {job?.clientConfirmedAt&&<p className={styles.stage} role="status">
   <strong>Receipt acknowledged by customer</strong>
   <span>{new Date(job.clientConfirmedAt).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Lagos"})}</span>
  </p>}
  {viewerRole==="CLIENT"&&job&&!job.clientConfirmedAt&&state.bookingStatus!=="DISPUTED"&&
   ["DELIVERED","COLLECTED"].includes(job.status)&&
   <div className={styles.form}>
    <p className={styles.hint}>The business has marked the item as {job.status==="DELIVERED"?"delivered":"collected"}.
     Confirm only if you actually received it. This does not approve work quality or release escrow.</p>
    <button type="button" disabled={busy} onClick={()=>void acknowledge()}>
     {busy?"Recording…":"Confirm I received my item"}
    </button>
   </div>}
  {viewerRole==="CLIENT"&&(!job||job.status==="AWAITING_INTAKE")&&<form className={styles.form} onSubmit={e=>void save(e)}>
   <label>How will the business receive your items?
    <select value={intake} onChange={e=>setIntake(e.target.value)} disabled={busy} required>
     {state.offeredMethods?.handoverMethods.map(x=><option key={x} value={x}>{labels[x]??x}</option>)}
    </select>
   </label>
   <label>How would you like the finished items returned?
    <select value={returnVia} onChange={e=>setReturnVia(e.target.value)} disabled={busy} required>
     {state.offeredMethods?.returnMethods.map(x=><option key={x} value={x}>{labels[x]??x}</option>)}
    </select>
   </label>
   <button disabled={busy||!intake||!returnVia}>{busy?"Saving…":"Save preferences"}</button>
  </form>}
  {job?.status!=="AWAITING_INTAKE"&&job&&<p className={styles.hint}>
   Selected: {labels[job.intakeMethod]??job.intakeMethod} · {labels[job.returnMethod]??job.returnMethod}. Contact the business to request changes after intake.
  </p>}
  {job&&<ItemDeliveryCase bookingId={bookingId} onCaseChanged={()=>{
    void adaptiveClient.bookingOps(bookingId).then(setState).catch(()=>{});
  }}/>}
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  {notice&&<p role="status" className={styles.notice}>{notice}</p>}
  <p className={styles.hint}>When the business marks work ready, a Hustle in-app notification is sent if enabled. Delivery or collection status is not proof of escrow release.</p>
 </section>;
}
