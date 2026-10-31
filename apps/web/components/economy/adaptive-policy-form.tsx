"use client";

import styles from "./adaptive-policy-form.module.css";

import type { AdaptivePolicy, AdaptivePolicyValue } from "../../lib/adaptive";
export type { AdaptivePolicy };

type Props = {
  blueprint: string;
  policy: AdaptivePolicy;
  onChange: (next: AdaptivePolicy) => void;
  disabled?: boolean;
};
const options = {
  consultation: [["disabled","No consultation"],["optional","Client may consult"],["required","Consultation required"]],
  location: [["onsite","In person"],["remote","Remote"],["hybrid","Both"]],
  measurements: [["not_required","Not needed"],["shop_visit","At my shop"],["home_visit","At the client's place"],["guided_remote","Guided online measurement"]],
  intake: [["drop_off","Client drops off"],["home_pickup","We collect"],["courier","Courier collection"]],
  return: [["shop_pickup","Client collects"],["home_delivery","We deliver"],["courier","Courier delivery"]]
} as const;

export function AdaptivePolicyForm({ blueprint, policy, onChange, disabled }: Props) {
  const set = (key: string, value: AdaptivePolicyValue) => onChange({ ...policy, [key]: value });
  const number = (key: string, label: string, min: number, max: number, help?: string) => (
    <label className={styles.field} key={key}>
      <span>{label}</span>
      <input type="number" required min={min} max={max} step="1" disabled={disabled}
        value={typeof policy[key] === "number" ? (policy[key] as number) : min}
        onChange={event => set(key, Number(event.target.value))} />
      {help && <small>{help}</small>}
    </label>
  );
  const amount = (key: string, label: string) => (
    <label className={styles.field} key={key}>
      <span>{label}</span>
      <input type="number" min={0} max={20000000} step=".01" required disabled={disabled}
        value={(typeof policy[key] === "number" ? policy[key] as number : 0) / 100}
        onChange={event => set(key, Math.round(Number(event.target.value) * 100))} />
      <small>Configuration only. No fee is collected by saving this draft.</small>
    </label>
  );
  const toggle = (key: string, label: string) => (
    <label className={styles.toggle} key={key}>
      <input type="checkbox" disabled={disabled} checked={policy[key] === true}
        onChange={event => set(key, event.target.checked)} />
      <span>{label}</span>
    </label>
  );
  const select = (key: string, label: string, values: readonly (readonly [string,string])[]) => (
    <label className={styles.field} key={key}>
      <span>{label}</span>
      <select disabled={disabled} value={String(policy[key] ?? values[0]?.[0] ?? "")}
        onChange={event => {
          const value = event.target.value;
          if (key === "consultationMode" && value === "disabled")
            onChange({ ...policy, consultationMode: value, consultationFeeMinor: 0, creditConsultation: false });
          else if (key === "itemType" && value === "laundry")
            onChange({ ...policy, itemType: value, measurementMethods: ["not_required"] });
          else set(key, value);
        }}>
        {values.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );
  const multi = (key: string, label: string, values: readonly (readonly [string,string])[]) => {
    const selected: string[] = Array.isArray(policy[key]) ? policy[key] as string[] : [];
    return <fieldset className={styles.multi} key={key}><legend>{label}</legend>
      {values.map(([id, text]) => <label key={id}>
        <input type="checkbox" disabled={disabled} checked={selected.includes(id)}
          onChange={e => {
            let next = e.target.checked ? [...selected,id] : selected.filter(s => s !== id);
            if (key === "measurementMethods" && e.target.checked) {
              if (id === "not_required") next = ["not_required"];
              else next = next.filter(v => v !== "not_required");
            }
            // Prevent invalid empty delivery/intake/measurement configurations.
            if (next.length) set(key,next);
          }} />{text}
      </label>)}
    </fieldset>;
  };
  const consultation = () => <>
    {select("consultationMode", "Consultation", options.consultation)}
    {policy.consultationMode !== "disabled" && <>
      {amount("consultationFeeMinor","Consultation fee (₦)")}
      {toggle("creditConsultation","Deduct the paid consultation fee from an eventual booking")}
    </>}
  </>;
  return <div className={styles.root}>
    <div className={styles.heading}>
      <strong>Adapt this service</strong>
      <p>These are setup preferences, not confirmed availability or automatic payments.</p>
    </div>
    {blueprint === "appointment" && <>
      {number("durationMinutes","Service duration (minutes)",5,720)}
      {number("bookingWindowDays","Days ahead clients can request",1,365)}
      <div className={styles.group}>
        {number("availableProfessionals","Available professionals",1,200,"Edit this when team members join or leave.")}
        {number("availableStations","Usable stations / chairs",1,200)}
        {number("concurrentCapacity","Maximum simultaneous appointments",1,100,"Cannot exceed professionals or stations. Real capacity will be validated before booking.")}
      </div>
      {consultation()}
      {toggle("homeService","Allow home or off-site visits")}
    </>}
    {blueprint === "item" && <>
      {select("itemType","Type of work",[
        ["laundry","Laundry and garment care"],["tailoring","Tailoring"],["shoemaking","Shoemaking"],["repair","Repairs"],["other","Other item-based service"]
      ])}
      {number("turnaroundHours","Estimated turnaround (hours)",1,2160,"This is an estimate. The professional must mark each job ready.")}
      {multi("handoverMethods","How the item reaches you",options.intake)}
      {multi("returnMethods","How the finished item reaches the client",options.return)}
      {policy.itemType !== "laundry" && multi("measurementMethods","How measurements or sizing are taken",options.measurements)}
      {toggle("notifyWhenReady","Notify client when the work is actually ready")}
      {toggle("needsClientApproval","Require client approval before work starts")}
    </>}
    {blueprint === "project" && <>
      {number("estimatedDays","Estimated project duration (days)",1,365)}
      {number("revisionRounds","Included revision rounds",0,30)}
      {toggle("milestoneReview","Use milestone reviews")}
      {consultation()}
      {select("meetingMode","Work and meeting mode",options.location)}
    </>}
    {blueprint === "group" && <>
      {number("maxParticipants","Maximum participants",2,500)}
      {number("sessionMinutes","Duration per session (minutes)",15,480)}
      {number("sessionCount","Number of sessions",1,100)}
      {select("meetingMode","Session format",options.location)}
      {toggle("registrationApproval","Approve registrations manually")}
    </>}
    {blueprint === "event" && <>
      {number("minimumLeadDays","Minimum booking notice (days)",0,365)}
      {number("teamMembersNeeded","Professionals required per event",1,100)}
      {number("estimatedGuests","Estimated event guests",1,100000)}
      {toggle("quoteRequired","Provide a custom quote before confirming")}
      {toggle("homeOrVenueService","Work at client's venue")}
    </>}
    {blueprint === "product" && <>
      {select("stockMode","How stock is managed",[
        ["made_to_order","Made to order"],["tracked","Tracked stock"],["unlimited_digital","Digital item"]
      ])}
      {number("productionDays","Production or preparation time (days)",0,365)}
      {number("returnsDays","Return window (days)",0,90)}
      {toggle("deliveryAvailable","Allow delivery")}
    </>}
    {blueprint === "digital" && <>
      {number("estimatedDays","Delivery estimate (days)",1,365)}
      {number("revisionRounds","Included revisions",0,30)}
      {toggle("fileDelivery","Deliver files through Hustle")}
      {toggle("milestoneReview","Enable milestone reviews")}
      {consultation()}
    </>}
    {blueprint === "recurring" && <>
      {select("frequency","Repeat frequency",[
        ["daily","Daily"],["weekly","Weekly"],["biweekly","Every two weeks"],["monthly","Monthly"]
      ])}
      {number("durationMinutes","Duration per visit (minutes)",5,720)}
      {number("sessionsPerCycle","Visits per cycle",1,31)}
      {number("availableProfessionals","Available workers",1,200)}
      {toggle("pauseAllowed","Permit pauses by agreement")}
    </>}
    {blueprint === "live" && <>
      {number("maxAttendees","Maximum attendees",1,100000)}
      {number("durationMinutes","Live session duration (minutes)",5,720)}
      {toggle("registrationRequired","Require registration")}
      {toggle("replayAvailable","Make replay available")}
    </>}
  </div>;
}
