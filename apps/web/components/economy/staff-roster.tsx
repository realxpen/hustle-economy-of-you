"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { adaptiveClient, type AdaptiveRoster, type AdaptiveStaff, type WeeklyShift } from "../../lib/adaptive";
import styles from "./staff-roster.module.css";

const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const initialDays=[1,2,3,4,5,6];
const nextDay=(value:string)=>{
 const d=new Date(value+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+1);
 return d.toISOString().slice(0,10);
};
function explain(e:unknown){return e instanceof Error?e.message:"Action failed. Retry."}
function ScheduleRows({value,onChange,disabled}:{value:WeeklyShift[];onChange:(v:WeeklyShift[])=>void;disabled:boolean}){
 return <div className={styles.shifts}>
  <strong>Weekly shifts</strong>
  {!value.length&&<small>No shifts set — this person cannot accept appointments.</small>}
  {value.map((shift,i)=><div className={styles.shift} key={i}>
   <select aria-label={"Day for shift "+(i+1)} disabled={disabled} value={shift.day}
    onChange={e=>onChange(value.map((x,j)=>j===i?{...x,day:Number(e.target.value)}:x))}>
    {days.map((name,j)=><option key={name} value={j}>{name}</option>)}
   </select>
   <input type="time" aria-label="Shift starts" disabled={disabled} value={shift.start}
    onChange={e=>onChange(value.map((x,j)=>j===i?{...x,start:e.target.value}:x))}/>
   <input type="time" aria-label="Shift ends" disabled={disabled} value={shift.end}
    onChange={e=>onChange(value.map((x,j)=>j===i?{...x,end:e.target.value}:x))}/>
   <button type="button" disabled={disabled} aria-label={"Remove shift "+(i+1)}
    onClick={()=>onChange(value.filter((_,j)=>j!==i))}>×</button>
  </div>)}
  <button type="button" disabled={disabled||value.length>=28} className={styles.secondary}
   onClick={()=>onChange([...value,{day:1,start:"09:00",end:"17:00"}])}>Add another shift</button>
 </div>;
}
export function StaffRoster({workspaceId,canManage}:{workspaceId:string;canManage:boolean}){
 const [data,setData]=useState<AdaptiveRoster|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [name,setName]=useState("");
 const [shifts,setShifts]=useState<WeeklyShift[]>(initialDays.map(day=>({day,start:"09:00",end:"17:00"})));
 const [stations,setStations]=useState(1);
 const [enabled,setEnabled]=useState(false);
 const [editing,setEditing]=useState<string|null>(null);
 const [edits,setEdits]=useState<WeeklyShift[]>([]);
 const [editName,setEditName]=useState("");
 const [leave,setLeave]=useState<{staffId:string;start:string;end:string;note:string}>({staffId:"",start:"",end:"",note:""});
 const load=useCallback(async()=>{
  const roster=await adaptiveClient.roster(workspaceId);
  setData(roster);setStations(roster.stationCapacity);setEnabled(roster.rosterEnabled);
 },[workspaceId]);
 useEffect(()=>{
  let mounted=true;
  setData(null);setError("");
  void adaptiveClient.roster(workspaceId).then(x=>{
   if(mounted){setData(x);setStations(x.stationCapacity);setEnabled(x.rosterEnabled)}
  }).catch(e=>{if(mounted)setError(explain(e))});
  return ()=>{mounted=false};
 },[workspaceId]);
 async function save(action:()=>Promise<unknown>,done:string){
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{
   const result=await action() as {affectedExistingBookings?:number};
   await load();
   setNotice(done+(result?.affectedExistingBookings?
    " Review "+result.affectedExistingBookings+" existing accepted commitments affected by staffing changes.":""));
   return true;
  }catch(e){setError(explain(e));return false;}
  finally{setBusy(false)}
 }
 const submit=(e:FormEvent<HTMLFormElement>,fn:()=>void)=>{e.preventDefault();fn()};
 function startEdit(s:AdaptiveStaff){
  setEditing(s.id);setEditName(s.displayName);setEdits(s.weeklyHours.map(x=>({...x})));setError("");
 }
 return <section className={styles.root} aria-label="Business staff and availability">
  <div className={styles.heading}>
   <div><small>OPERATIONS</small><h2>Staff & availability</h2>
    <p>Manage workers, chairs, shifts, and time off. Workers can be listed without needing to use the app.</p></div>
   <Link href="/services/manage">Manage service opening hours</Link>
  </div>
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  {notice&&<p role="status" className={styles.notice}>{notice}</p>}
  {!data?<p>{error?"Roster unavailable in this environment.":"Loading roster…"}</p>:<>
   <form className={styles.panel} onSubmit={e=>submit(e,()=>void save(
     ()=>adaptiveClient.rosterSettings(workspaceId,{stationCapacity:stations,rosterEnabled:enabled}),
     "Workforce capacity settings updated."))}>
    <h3>Business capacity</h3>
    <label className={styles.field}>Usable chairs / work stations
     <input type="number" value={stations} min={1} max={200} step={1} required disabled={!canManage||busy}
      onChange={e=>setStations(Number(e.target.value))}/>
    </label>
    <label className={styles.check}><input type="checkbox" checked={enabled} disabled={!canManage||busy}
     onChange={e=>setEnabled(e.target.checked)}/>
     <span>Use staff shifts and leave when checking available appointment slots</span>
    </label>
    <p className={styles.hint}>When enabled, appointments cannot exceed working staff, stations, or the service's own limit. You must add an active worker with shifts first. Existing reservations are not automatically cancelled.</p>
    <button disabled={!canManage||busy} type="submit">Save business capacity</button>
   </form>
   <div className={styles.panel}>
    <div className={styles.count}><h3>Team roster</h3><small>{data.activeStaff} active · {data.staff.length} recorded</small></div>
    {!data.staff.length&&<p className={styles.hint}>No workers added yet. Add the owner or staff members, even if they do not have Hustle accounts.</p>}
    {data.staff.map(s=><article key={s.id} className={styles.member}>
     <div className={styles.count}>
      <div><strong>{s.displayName}</strong><small>{s.active?"Available for shifts":"Inactive / no new appointments"} · revision {s.revision}</small></div>
      {canManage&&<button type="button" className={styles.secondary} disabled={busy}
       onClick={()=>void save(()=>adaptiveClient.updateStaff(workspaceId,s.id,{
        displayName:s.displayName,active:!s.active,weeklyHours:s.weeklyHours,expectedRevision:s.revision
       }),s.active?"Staff member made inactive.":"Staff member reactivated.")}>{s.active?"Mark inactive":"Reactivate"}</button>}
     </div>
     <p className={styles.hint}>{s.weeklyHours.length} weekly shift windows · {s.leave.length} upcoming or recorded leave periods</p>
     {canManage&&editing!==s.id&&<button type="button" className={styles.secondary} onClick={()=>startEdit(s)}>Edit shifts</button>}
     {editing===s.id&&<div className={styles.editor}>
      <label className={styles.field}>Staff display name<input minLength={2} maxLength={80} value={editName} onChange={e=>setEditName(e.target.value)} disabled={busy}/></label>
      <ScheduleRows value={edits} onChange={setEdits} disabled={busy}/>
      <div className={styles.actions}>
       <button type="button" disabled={busy} onClick={()=>void save(
        ()=>adaptiveClient.updateStaff(workspaceId,s.id,{displayName:editName,
         active:s.active,weeklyHours:edits,expectedRevision:s.revision}),
         "Staff details saved.").then(ok=>{if(ok)setEditing(null)})}>Save shifts</button>
       <button type="button" className={styles.secondary} onClick={()=>setEditing(null)}>Cancel</button>
      </div>
     </div>}
     {s.leave.map(l=><div key={l.id} className={styles.absence}>
      <span>Off: {new Date(l.startAt).toLocaleDateString("en-NG",{timeZone:"Africa/Lagos"})} – {new Date(l.endAt).toLocaleDateString("en-NG",{timeZone:"Africa/Lagos"})}{l.note?" · "+l.note:""}</span>
      {canManage&&<button type="button" disabled={busy} className={styles.secondary}
       onClick={()=>void save(()=>adaptiveClient.cancelStaffLeave(workspaceId,s.id,l.id),"Time off cancelled.")}>Cancel leave</button>}
     </div>)}
     {canManage&&leave.staffId!==s.id&&<button type="button" className={styles.secondary}
      onClick={()=>setLeave({staffId:s.id,start:"",end:"",note:""})}>Record time off</button>}
     {canManage&&leave.staffId===s.id&&<form className={styles.leaveForm}
      onSubmit={e=>submit(e,()=>void save(()=>adaptiveClient.staffLeave(workspaceId,s.id,{
       startAt:leave.start+"T00:00:00+01:00",endAt:nextDay(leave.end)+"T00:00:00+01:00",note:leave.note
      }),"Time off recorded.").then(ok=>{if(ok)setLeave({staffId:"",start:"",end:"",note:""})}))}>
      <p className={styles.hint}>Full days in Africa/Lagos time. Existing booked customers may need reassignment.</p>
      <label>First day off<input required type="date" value={leave.start} disabled={busy}
       onChange={e=>setLeave({...leave,start:e.target.value})}/></label>
      <label>Last day off (included)<input required type="date" min={leave.start} value={leave.end} disabled={busy}
       onChange={e=>setLeave({...leave,end:e.target.value})}/></label>
      <label>Reason (optional)<input maxLength={180} value={leave.note} disabled={busy}
       onChange={e=>setLeave({...leave,note:e.target.value})}/></label>
      <div className={styles.actions}><button type="submit" disabled={busy||!leave.start||!leave.end}>Save leave</button>
       <button type="button" className={styles.secondary} onClick={()=>setLeave({staffId:"",start:"",end:"",note:""})}>Cancel</button>
      </div>
     </form>}
    </article>)}
   </div>
   {canManage&&<form className={styles.panel} onSubmit={e=>submit(e,()=>void save(
    ()=>adaptiveClient.addStaff(workspaceId,{displayName:name,weeklyHours:shifts}),"Team member added.").then(ok=>{
      if(ok){setName("");setShifts(initialDays.map(day=>({day,start:"09:00",end:"17:00"})));}
    }))}>
    <h3>Add a team member</h3>
    <p className={styles.hint}>Add an existing worker or an offline worker by display name. This does not create an account, issue an invitation, or grant wallet access.</p>
    <label className={styles.field}>Name to display
     <input required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)}
      placeholder="e.g. Kemi — Stylist" disabled={busy}/>
    </label>
    <ScheduleRows value={shifts} onChange={setShifts} disabled={busy}/>
    <button type="submit" disabled={busy||name.trim().length<2}>Add worker</button>
   </form>}
   <p className={styles.hint}>{data.warning} Staff identity and schedule rights remain separate from account membership and agent consent.</p>
  </>}
 </section>;
}
