"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./experience-header.module.css";
import { ExperienceThemeControl } from "./experience-theme-control";

type NavItem = { href: string; label: string };
const primary: readonly NavItem[] = [
  { href: "/home", label: "Discover" },
  { href: "/search", label: "Search" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/bookings", label: "Bookings" },
  { href: "/orders", label: "Orders" },
  { href: "/account", label: "You" }
];

function active(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(href + "/");
}

export function ExperienceHeader({
  section,
  trail = [],
  actions,
  secondaryLinks = []
}: {
  section: string;
  trail?: NavItem[];
  actions?: ReactNode;
  secondaryLinks?: NavItem[];
}) {
  const pathname = usePathname();
  return <header className={styles.header}>
    <div className={styles.primaryRow}>
      <Link className={styles.brand} href="/home" aria-label="Hustle Discover">
        HUSTLE<span className={styles.mark} aria-hidden="true">↗</span>
      </Link>
      <nav className={styles.primaryNav} aria-label="Hustle desktop navigation">
        {primary.map(item => <Link
          key={item.href}
          href={item.href}
          aria-current={active(pathname, item.href) ? "page" : undefined}
          className={active(pathname, item.href) ? styles.current : undefined}
        >{item.label}</Link>)}
      </nav>
      {actions && <div className={styles.actions}>{actions}</div>}
      <div className={styles.appearance}><ExperienceThemeControl /></div>
      <Link className={styles.mobileMarket} href="/marketplace">Explore offers <span aria-hidden="true">↗</span></Link>
    </div>
    <div className={styles.contextRow}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
        <Link href="/home">Hustle</Link>
        <span aria-hidden="true">/</span>
        {trail.map(item => <span className={styles.crumb} key={item.href}>
          <Link href={item.href}>{item.label}</Link><span aria-hidden="true">/</span>
        </span>)}
        <span aria-current="page" className={styles.section}>{section}</span>
      </nav>
      {secondaryLinks.length > 0 && <nav aria-label={section + " sections"} className={styles.localNav}>
        {secondaryLinks.map(item => <a key={item.href} href={item.href}>{item.label}</a>)}
      </nav>}
    </div>
  </header>;
}
