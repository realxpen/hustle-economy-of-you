"use client";

import type { BookingStatus } from "../../lib/booking";
import type { OrderStatus } from "../../lib/commerce";
import styles from "./transaction-journey.module.css";

type Kind = "BOOKING" | "ORDER";
type Props = { kind: "BOOKING"; status: BookingStatus; paymentRequired: boolean; funded: boolean }
  | { kind: "ORDER"; status: OrderStatus; paid: boolean };

const bookingSteps = ["Request sent", "Accepted", "Funding confirmed", "In progress", "Completed"];
const orderSteps = ["Order created", "Paid", "Processing", "Delivered", "Completed"];

function bookingIndex(status: BookingStatus) {
  if (status === "REQUESTED") return 0;
  if (status === "ACCEPTED" || status === "PAYMENT_PENDING") return 1;
  if (status === "FUNDED") return 2;
  if (status === "IN_PROGRESS") return 3;
  if (status === "COMPLETED") return 4;
  return -1;
}
function orderIndex(status: OrderStatus) {
  if (status === "PENDING") return 0;
  if (status === "PAID") return 1;
  if (status === "PROCESSING" || status === "SHIPPED") return 2;
  if (status === "DELIVERED") return 3;
  if (status === "COMPLETED") return 4;
  return -1;
}

export function TransactionJourney(props: Props) {
  const kind: Kind = props.kind;
  const steps = props.kind === "BOOKING"
    ? bookingSteps.map((step, index) => index === 2
      ? !props.paymentRequired ? "No funding needed"
        : props.funded ? "Funding confirmed" : "Funding unconfirmed"
      : step)
    : orderSteps.map((step, index) => index === 1 && !props.paid ? "Payment unconfirmed" : step);
  const current = props.kind === "BOOKING" ? bookingIndex(props.status) : orderIndex(props.status);
  const suspended = current < 0;
  // A later work/fulfillment state must never fabricate a verified payment.
  const isReached = (index: number) => index < current &&
    !(props.kind === "BOOKING" && index === 2 && props.paymentRequired && !props.funded) &&
    !(props.kind === "ORDER" && index === 1 && !props.paid);
  const status = props.status.replaceAll("_", " ").toLowerCase();
  return <section className={styles.panel} aria-label={kind === "BOOKING" ? "Booking progress" : "Order progress"}>
    <div className={styles.heading}>
      <strong>{kind === "BOOKING" ? "Your booking journey" : "Your order journey"}</strong>
      <span>{suspended ? "Current status: " + status : kind === "ORDER" && current === 0
        ? "Order created · payment not confirmed" : "From Hustle's transaction record"}</span>
    </div>
    {suspended ? <p className={styles.outcome}>This {kind.toLowerCase()} is {status}. See the authoritative status and next action below; the normal steps do not imply it was funded or completed.</p>
      : <ol className={styles.steps}>
        {steps.map((label, index) => <li key={label} className={isReached(index) ? styles.done : index === current ? styles.current : styles.future}
          aria-current={index === current ? "step" : undefined}>
          <span className={styles.mark} aria-hidden="true">{isReached(index) ? "✓" : index + 1}</span>
          <span>{label}</span>
        </li>)}
      </ol>}
  </section>;
}
