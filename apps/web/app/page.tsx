"use client";

import { useEffect, useState } from "react";
import type { FoundationHealth } from "@hustle/types";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function HomePage() {
  const [health, setHealth] = useState<FoundationHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiBase) return;
    fetch(`${apiBase}/health`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        return response.json() as Promise<FoundationHealth>;
      })
      .then(setHealth)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">HUSTLE / PHASE 1</p>
        <h1>The Economy of You.</h1>
        <p className="lede">The technical foundation is being built for a content-first economy where skill becomes discoverable, trusted and economically useful.</p>
        <div className="loop">Skill <span>→</span> Demonstration <span>→</span> Discovery <span>→</span> Trust <span>→</span> Opportunity</div>
      </section>

      <section className="statusGrid" aria-label="Foundation status">
        <article><span>Web</span><strong>Ready</strong><small>Next.js preview surface</small></article>
        <article><span>API</span><strong>{health ? health.status : apiBase ? "Checking" : "Awaiting URL"}</strong><small>{error ?? "NestJS foundation"}</small></article>
        <article><span>Database</span><strong>{health?.dependencies.database ?? "Not configured"}</strong><small>PostgreSQL + Prisma</small></article>
        <article><span>Cache</span><strong>{health?.dependencies.redis ?? "Not configured"}</strong><small>Redis boundary</small></article>
      </section>

      <footer><span>Hustle</span><span>Phase 1 — Technical Foundation</span></footer>
    </main>
  );
}
