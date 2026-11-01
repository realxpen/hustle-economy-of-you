"use client";
import { useEffect, useState, type FormEvent } from "react";
import { adaptiveClient, type AdaptiveDeliveryCase } from "../../lib/adaptive";
import styles from "./item-delivery-case.module.css";

/** Only the booking's actual participants receive a case view from the API. */
export function ItemDeliveryCase({ bookingId, onCaseChanged }: { bookingId: string; onCaseChanged?: () => void }) {
  const [record, setRecord] = useState<AdaptiveDeliveryCase | null>(null);
  const [statement, setStatement] = useState("");
  const [evidenceType, setEvidenceType] = useState("NONE");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setRecord(null); setError(""); setNotice("");
    void adaptiveClient.deliveryCase(bookingId)
      .then(data => { if (active) setRecord(data); })
      .catch(error => {
        if (active) setError(error instanceof Error ? error.message : "Delivery case unavailable");
      });
    return () => { active = false; };
  }, [bookingId]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!record || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const input = {
        statement: statement.trim(),
        evidenceType,
        reference: evidenceType === "NONE" ? "" : reference.trim(),
        expectedRevision: record.expectedRevision
      };
      const updated = record.canOpen
        ? await adaptiveClient.openDeliveryCase(bookingId, input)
        : await adaptiveClient.deliveryStatement(bookingId, input);
      setRecord(updated);
      onCaseChanged?.();
      setStatement(""); setReference(""); setEvidenceType("NONE");
      setNotice(record.canOpen
        ? "Delivery objection recorded for Hustle casework review. Booking is disputed; no funds were released."
        : "Your statement is recorded and the other participant has been notified.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Case changed. Refresh and try again.");
      try { setRecord(await adaptiveClient.deliveryCase(bookingId)); } catch { /* Keep the previous view */ }
    } finally {
      setBusy(false);
    }
  }

  if (!record || (!record.canOpen && !record.case && !record.hasOtherCase)) return null;
  return <section className={styles.root} aria-label="Delivery dispute and evidence">
    <h3>Physical delivery &amp; dispute</h3>
    {record.hasOtherCase && <p>A marketplace case is already associated with this booking.
      Contact Hustle support to add delivery information to the existing case.</p>}
    {record.case && <>
      <p className={styles.status}>Hustle case: {record.case.status.replaceAll("_", " ").toLowerCase()}</p>
      <p>Both parties may provide statements for the existing marketplace case.
        A statement or provider delivery marker does not automatically prove receipt or settle escrow.</p>
      <ol className={styles.history}>
        {record.statements.map(entry => {
          const details = entry.details;
          return <li key={entry.id}>
            <strong>{entry.author === "YOU" ? "You" : "Other participant"}</strong>
            <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString("en-NG", {
              dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos"
            })}</time>
            <p>{details.statement}</p>
            {details.evidenceType && details.evidenceType !== "NONE" &&
              <small>{details.evidenceType.replaceAll("_", " ").toLowerCase()}: {details.reference}
                {" "}· Not independently verified</small>}
          </li>;
        })}
      </ol>
    </>}
    {record.canOpen && <p>The business marked your item as delivered or collected, but you haven't
      confirmed receipt. If you have not physically received it, open a claim for review.
      This places the Booking in DISPUTED status and does not request or authorize a refund.</p>}
    {(record.canOpen || record.canRespond) && <form onSubmit={e => void submit(e)} className={styles.form}>
      <label>{record.canOpen ? "Explain why you have not received your item" : "Add a statement or response"}
        <textarea value={statement} onChange={e => setStatement(e.target.value)}
          required minLength={record.canOpen ? 30 : 10} maxLength={2000} rows={3}
          disabled={busy} placeholder="Describe what happened and any evidence you can provide." />
      </label>
      <label>Supporting reference (optional)
        <select value={evidenceType} onChange={e => setEvidenceType(e.target.value)} disabled={busy}>
          <option value="NONE">No reference</option>
          <option value="COURIER_REFERENCE">Courier tracking ID</option>
          <option value="HANDOVER_REFERENCE">Handover/reference number</option>
          <option value="MESSAGE_REFERENCE">Message/reference number</option>
        </select>
      </label>
      {evidenceType !== "NONE" && <label>Reference ID
        <input value={reference} onChange={e => setReference(e.target.value)}
          minLength={3} maxLength={180} required disabled={busy}
          placeholder="Reference number (not a web link)" />
      </label>}
      <button type="submit" disabled={busy || statement.trim().length < (record.canOpen ? 30 : 10) ||
        (evidenceType !== "NONE" && reference.trim().length < 3)}>
        {busy ? "Recording…" : record.canOpen ? "Dispute physical delivery" : "Add statement"}
      </button>
      <small>References are participant-supplied, not verified proof. Photo uploads and
        financial resolutions must use separately authorized review processes.</small>
    </form>}
    {record.case && !record.canRespond && <p>Further updates require Hustle casework review.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
  </section>;
}
