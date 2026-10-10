"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { getUnreadNotificationCount } from "../../lib/notifications";
import styles from "./hustle-mobile-nav.module.css";

type NavIcon = "discover" | "search" | "market" | "messages" | "activity" | "identity";
const items: ReadonlyArray<{ href: string; label: string; icon: NavIcon }> = [
  { href: "/home", label: "Discover", icon: "discover" },
  { href: "/search", label: "Search", icon: "search" },
  { href: "/marketplace", label: "Market", icon: "market" },
  { href: "/messages", label: "Inbox", icon: "messages" },
  { href: "/notifications", label: "Activity", icon: "activity" },
  { href: "/account", label: "You", icon: "identity" }
];

function Icon({ name }: { name: NavIcon }) {
  const shared = {
    width: 22, height: 22, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 1.9,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    "aria-hidden": true as const
  };
  if (name === "discover") return <svg {...shared}><circle cx="12" cy="12" r="9" /><path d="m15.6 8.4-2.5 4.7-4.7 2.5 2.5-4.7z" /></svg>;
  if (name === "search") return <svg {...shared}><circle cx="10.8" cy="10.8" r="7" /><path d="m16 16 5 5" /></svg>;
  if (name === "market") return <svg {...shared}><path d="M3 9.5 4.5 4h15L21 9.5M4 10v10h16V10M3 9.5c0 2 2 3.1 4 1.4 1.6 1.7 3.6 1.7 5 0 1.5 1.7 3.5 1.7 5 0 2 1.7 4 .6 4-1.4" /><path d="M9 20v-6h6v6" /></svg>;
  if (name === "messages") return <svg {...shared}><path d="M20 11.5a8.3 8.3 0 0 1-8.5 8.2 9 9 0 0 1-3.7-.8L3 20l1.2-4.1a8 8 0 0 1-1.2-4.4 8.4 8.4 0 0 1 8.5-8.2 8.4 8.4 0 0 1 8.5 8.2Z"/><path d="M8 11.5h8" /></svg>;
  if (name === "activity") return <svg {...shared}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></svg>;
  return <svg {...shared}><circle cx="12" cy="8" r="4" /><path d="M4.5 21v-1.7a7.5 7.5 0 0 1 15 0V21" /></svg>;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function hideNavigation(pathname: string) {
  return pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/internal") ||
    pathname.startsWith("/live/") ||
    pathname.startsWith("/messages/") ||
    pathname.startsWith("/agent-workspace/onboarding/");
}

export function HustleMobileNav() {
  const pathname = usePathname();
  const [unread, setUnread] = useState<number | null>(null);
  const hidden = hideNavigation(pathname);

  useEffect(() => {
    if (hidden) return;
    let active = true;
    // Quiet failure is intentional: the dock should never block a public page
    // or sign-in just because a notification read is unavailable.
    getUnreadNotificationCount()
      .then(({ count }) => { if (active) setUnread(count); })
      .catch(() => { if (active) setUnread(null); });
    return () => { active = false; };
  }, [hidden, pathname]);

  if (hidden) return null;

  return <nav className={styles.dock} aria-label="Hustle main navigation">
    <div className={styles.inner}>
      {items.map(item => {
        const current = isActive(pathname, item.href);
        const count = item.icon === "activity" && unread && unread > 0 ? Math.min(unread, 99) : null;
        return <Link
          href={item.href}
          key={item.href}
          className={current ? `${styles.link} ${styles.selected}` : styles.link}
          aria-current={current ? "page" : undefined}
          aria-label={count ? `${item.label}, ${unread} unread notification groups` : item.label}
        >
          <span className={styles.icon}>
            <Icon name={item.icon} />
            {count !== null && <span className={styles.unread} aria-hidden="true">{unread && unread > 99 ? "99+" : count}</span>}
          </span>
          <span className={styles.label}>{item.label}</span>
        </Link>;
      })}
    </div>
  </nav>;
}
