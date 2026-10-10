"use client";

import { useEffect, useState } from "react";
import styles from "./experience-theme-control.module.css";

type Appearance = "system" | "light" | "dark";
const STORAGE_KEY = "hustle-appearance";

function isAppearance(value: string | null): value is Appearance {
  return value === "system" || value === "light" || value === "dark";
}

export function ExperienceThemeControl() {
  const [mode, setMode] = useState<Appearance>("system");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isAppearance(saved)) setMode(saved);
    } catch {
      // Browsing without storage still supports the system preference.
    }
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = mode === "system" ? (preference.matches ? "dark" : "light") : mode;
      document.documentElement.dataset.hustleTheme = resolved;
    };
    apply();
    preference.addEventListener("change", apply);
    return () => preference.removeEventListener("change", apply);
  }, [mode]);

  function change(value: Appearance) {
    setMode(value);
    try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* optional preference */ }
  }

  return <label className={styles.control}>
    <span className={styles.symbol} aria-hidden="true">{mode === "dark" ? "☾" : mode === "light" ? "☀" : "◐"}</span>
    <span className={styles.visuallyHidden}>Appearance</span>
    <select aria-label="Appearance: light, dark or system" value={mode} onChange={(event) => change(event.target.value as Appearance)}>
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>;
}
