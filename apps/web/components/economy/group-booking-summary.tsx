"use client";
import {useEffect,useState} from "react";
import {adaptiveClient} from "../../lib/adaptive";
import styles from "./group-booking-summary.module.css";
type Info={peopleCount:number;revision:number;assignments:{staffId:string;displayName:string;active:boolean}[]};
export function GroupBookingSummary({bookingId}:{bookingId:string}){
 const [group,setGroup]=useState<Info|null>(null);
 useEffect(()=>{
  let live=true;setGroup(null);
  void adaptiveClient.groupInfo(bookingId).then(data=>{if(live)setGroup(data.group)})
   .catch(()=>{if(live)setGroup(null)});
  return()=>{live=false};
 },[bookingId]);
 if(!group)return null;
 return <section className={styles.wrap} aria-label="Group appointment details">
  <p className={styles.eyebrow}>GROUP APPOINTMENT</p>
  <h2>{group.peopleCount} people · one booking</h2>
  <p>This reservation requires {group.peopleCount} simultaneous service places. The agreed Booking amount remains the displayed total; it has not been multiplied per person.</p>
  <div className={styles.members}>
   {group.assignments.length?group.assignments.map(x=><span key={x.staffId}>{x.displayName}{!x.active?" · currently unavailable":""}</span>):<small>Staff assignments pending business confirmation.</small>}
  </div>
  <small>Group staffing can change before the appointment. Contact the business about individual preferences, timing or pricing changes.</small>
 </section>;
}
