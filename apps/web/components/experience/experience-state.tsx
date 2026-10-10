import Link from "next/link";
import styles from "./experience-state.module.css";

type StateKind = "loading" | "empty" | "error";
type Action = { label: string; onClick: () => void; disabled?: boolean } | { label: string; href: string };

export function ExperienceState({
  kind,
  title,
  description,
  action,
  compact = false
}: {
  kind: StateKind;
  title: string;
  description?: string;
  action?: Action;
  compact?: boolean;
}) {
  return <div
    className={`${styles.state} ${styles[kind]} ${compact ? styles.compact : ""}`}
    role={kind === "error" ? "alert" : "status"}
    aria-live={kind === "error" ? "assertive" : "polite"}
    aria-busy={kind === "loading"}
  >
    {kind === "loading"
      ? <div className={styles.skeleton} aria-hidden="true">
          <span/><span/><span/>
        </div>
      : <div className={styles.symbol} aria-hidden="true">
          {kind === "empty" ? "◇" : "!"}
        </div>}
    <div className={styles.copy}>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
    {action && (("href" in action)
      ? <Link className={styles.action} href={action.href}>{action.label} <span aria-hidden="true">↗</span></Link>
      : <button className={styles.action} type="button" onClick={action.onClick} disabled={action.disabled}>{action.label} <span aria-hidden="true">↗</span></button>)}
  </div>;
}
