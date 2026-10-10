import styles from "./experience-status.module.css";

type StatusKind = "booking" | "order";

const meta: Record<string, { label: string; tone: "neutral" | "attention" | "positive" | "danger" }> = {
  REQUESTED: { label: "Requested", tone: "attention" },
  ACCEPTED: { label: "Accepted", tone: "neutral" },
  PAYMENT_PENDING: { label: "Payment pending", tone: "attention" },
  FUNDED: { label: "Funding confirmed", tone: "positive" },
  IN_PROGRESS: { label: "In progress", tone: "neutral" },
  PENDING: { label: "Unpaid · pending", tone: "attention" },
  PAID: { label: "Paid · confirmed", tone: "positive" },
  PROCESSING: { label: "Processing", tone: "neutral" },
  SHIPPED: { label: "Shipped", tone: "neutral" },
  DELIVERED: { label: "Delivered", tone: "neutral" },
  COMPLETED: { label: "Completed", tone: "positive" },
  DECLINED: { label: "Declined", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  DISPUTED: { label: "Disputed", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
  CLOSED: { label: "Closed", tone: "neutral" }
};

/** Presentation only: authoritative status is always supplied by the API. */
export function ExperienceStatus({ value, kind }: { value: string; kind: StatusKind }) {
  const normalized = value.toUpperCase();
  const entry = meta[normalized] ?? { label: value.replaceAll("_", " "), tone: "neutral" as const };
  return <span
    className={styles.status}
    data-tone={entry.tone}
    aria-label={`${kind === "booking" ? "Booking" : "Order"} status: ${entry.label}`}
  >{entry.label}</span>;
}
