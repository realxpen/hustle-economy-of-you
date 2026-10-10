"use client";

import Link from "next/link";
import styles from "./page.module.css";

type Skill = "barber" | "tailor" | "cook" | "designer" | "beauty" | "more";
const shortcuts: ReadonlyArray<{ id: Skill; label: string; query: string }> = [
  { id: "barber", label: "Barbers", query: "barber" },
  { id: "tailor", label: "Tailors", query: "tailor" },
  { id: "cook", label: "Cooks", query: "cook" },
  { id: "designer", label: "Designers", query: "designer" },
  { id: "beauty", label: "Beauty", query: "beauty" },
  { id: "more", label: "More", query: "" }
];

function SkillIcon({ type }: { type: Skill }) {
  const props = { width: 25, height: 25, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (type === "barber") return <svg {...props}><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="m8 8 11 11M8 16 19 5M14 10l5-5"/></svg>;
  if (type === "tailor") return <svg {...props}><path d="M4 4h7l2 4-4 4 2 9H4l2-9-3-4zM13 8l3-4h4l1 4-4 4 1 9h-7"/></svg>;
  if (type === "cook") return <svg {...props}><path d="M5 13a4 4 0 0 1 .4-7 4 4 0 0 1 7-1 4 4 0 0 1 6.6 3 3 3 0 0 1-2 5M5 13v6h12v-6M9 19v-5"/></svg>;
  if (type === "designer") return <svg {...props}><path d="m13 3 8 8-10 10H3v-8zM13 3 3 13M16 6l-3 3M3 21l5-5"/></svg>;
  if (type === "beauty") return <svg {...props}><path d="m12 2 2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4zM19 18l.8 1.2L21 20l-1.2.8L19 22l-.8-1.2L17 20l1.2-.8z"/></svg>;
  return <svg {...props}><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>;
}

export function HomeSkillShortcuts() {
  return <nav className={styles.skillLinks} aria-label="Popular skills">
    {shortcuts.map((item) => <Link
      key={item.id}
      href={item.query ? "/search?q=" + encodeURIComponent(item.query) : "/search"}
    ><SkillIcon type={item.id} /><span>{item.label}</span></Link>)}
  </nav>;
}
