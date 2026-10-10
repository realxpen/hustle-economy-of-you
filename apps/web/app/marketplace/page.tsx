"use client";

import { ExperienceHeader } from "../../components/navigation/experience-header";
import { ExperienceState } from "../../components/experience/experience-state";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  captureMarketplaceObservation,
  getMarketplacePage,
  type MarketplaceTab,
  type SearchFilters,
  type SearchPage,
  type SearchResult
} from "../../lib/search";
import { ResultCard } from "../search/result-card";
import styles from "../search/search.module.css";

const tabs: Array<{ id: MarketplaceTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "services", label: "Services" },
  { id: "products", label: "Products" }
];

function createSessionId() {
  const key = "hustle-marketplace-session";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const next = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `marketplace-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem(key, next);
  return next;
}

const emptyFilters: SearchFilters = {
  category: "",
  skill: "",
  location: "",
  nearby: false,
  minPrice: "",
  maxPrice: "",
  verified: "",
  deliveryMode: "",
  productType: ""
};

export default function MarketplacePage() {
  const [tab, setTab] = useState<MarketplaceTab>("all");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [items, setItems] = useState<SearchResult[]>([]);
  const [meta, setMeta] = useState<Pick<SearchPage, "nextCursor" | "hasMore" | "zeroResults">>({ nextCursor: null, hasMore: false, zeroResults: false });
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    setSessionId(createSessionId());
  }, []);

  async function browse(nextTab: MarketplaceTab, cursor: string | null = null, append = false) {
    const version = append ? requestVersion.current : ++requestVersion.current;
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const page = await getMarketplacePage(nextTab, { q: query, cursor, limit: 12, filters });
      if (version !== requestVersion.current) return;
      setItems((current) => append ? [...current, ...page.items] : page.items);
      setMeta({ nextCursor: page.nextCursor, hasMore: page.hasMore, zeroResults: page.zeroResults });

      if (sessionId) {
        void captureMarketplaceObservation("marketplace.viewed", {
          query: page.query,
          tab: nextTab,
          filters: page.filters,
          resultCount: page.items.length,
          sessionId
        }).catch(() => undefined);
      }
    } catch (reason) {
      if (version !== requestVersion.current) return;
      const message = reason instanceof Error ? reason.message : "Marketplace failed to load";
      setError(message);
      if (message.toLowerCase().includes("sign in")) setTimeout(() => window.location.assign("/auth"), 900);
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    void browse("all");
    // Initial browse should run once for the marketplace session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function switchTab(nextTab: MarketplaceTab) {
    setTab(nextTab);
    setItems([]);
    setMeta({ nextCursor: null, hasMore: false, zeroResults: false });
    void browse(nextTab);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setItems([]);
    setMeta({ nextCursor: null, hasMore: false, zeroResults: false });
    void browse(tab);
  }

  function openResult(item: SearchResult, position: number) {
    if (!sessionId) return Promise.resolve();
    return captureMarketplaceObservation("marketplace.result_clicked", {
      query: query.trim() || null,
      tab,
      filters: filters as Record<string, unknown>,
      resultType: item.kind,
      resultId: item.id,
      resultUrl: item.url,
      position,
      sessionId
    }).catch(() => undefined);
  }

  return <main className={[styles.shell, "h-experience-shell"].join(" ")}>
    <ExperienceHeader section="Marketplace" />

    <section className={[styles.hero, "h-experience-hero"].join(" ")}>
      <div className={styles.browseIntro}>
        <div><p className={styles.eyebrow}>MARKETPLACE</p><h1 className="h-experience-heading">Browse current economic opportunities.</h1></div>
        <a href="/search">Need something specific? Search →</a>
      </div>
      <p>Services and Products stay attached to the same professional identities and proof that created them.</p>
    </section>

    <form className={[styles.searchForm, "h-experience-content"].join(" ")} onSubmit={submit}>
      <div className={styles.searchBar} role="search">
        <input type="search" enterKeyHint="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Optional: narrow marketplace by keyword" aria-label="Narrow marketplace" />
        <button type="submit" disabled={loading}>{loading ? "Loading…" : "Browse"}</button>
      </div>
    </form>

    <div className={[styles.tabs, "h-experience-content"].join(" ")}>{tabs.map((item) => <button key={item.id} type="button" className={`${styles.tab} ${tab === item.id ? styles.tabActive : ""}`} aria-pressed={tab === item.id} onClick={() => switchTab(item.id)}>{item.label}</button>)}</div>

    <section className={styles.filters} aria-label="Marketplace filters">
      <input aria-label="Filter by category" placeholder="Category" value={filters.category ?? ""} onChange={(event) => setFilters({ ...filters, category: event.target.value })} />
      <input aria-label="Filter by skill" placeholder="Skill" value={filters.skill ?? ""} onChange={(event) => setFilters({ ...filters, skill: event.target.value })} />
      <input aria-label="Filter by location" placeholder="Location" value={filters.location ?? ""} onChange={(event) => setFilters({ ...filters, location: event.target.value })} />
      <input aria-label="Minimum price in naira" placeholder="Min price ₦" inputMode="numeric" value={filters.minPrice ?? ""} onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })} />
      <input aria-label="Maximum price in naira" placeholder="Max price ₦" inputMode="numeric" value={filters.maxPrice ?? ""} onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })} />
      <select aria-label="Filter by verification" value={filters.verified ?? ""} onChange={(event) => setFilters({ ...filters, verified: event.target.value })}><option value="">Any verification</option><option value="true">Verified sellers</option><option value="false">Unverified sellers</option></select>
      <select aria-label="Filter by service delivery" value={filters.deliveryMode ?? ""} onChange={(event) => setFilters({ ...filters, deliveryMode: event.target.value })}><option value="">Any service delivery</option><option value="REMOTE">Remote</option><option value="PHYSICAL">Physical</option><option value="BOTH">Both</option></select>
      <select aria-label="Filter by product type" value={filters.productType ?? ""} onChange={(event) => setFilters({ ...filters, productType: event.target.value })}><option value="">Any product type</option><option value="PHYSICAL">Physical product</option><option value="DIGITAL">Digital product</option></select>
      <label className={styles.checkField}><input type="checkbox" checked={Boolean(filters.nearby)} onChange={(event) => setFilters({ ...filters, nearby: event.target.checked })} /> Nearby me</label>
      <button className={styles.primaryButton} type="button" disabled={loading} onClick={() => void browse(tab)}>Apply filters</button>
      <button className={styles.resetButton} type="button" disabled={loading} onClick={() => { setFilters(emptyFilters); setError(null); }}>Clear filters</button>
    </section>

    <section className={[styles.resultsWrap, "h-experience-content"].join(" ")}>
      <div className={styles.resultMeta} role="status" aria-live="polite"><strong>{tab === "all" ? "Marketplace" : tab === "services" ? "Services" : "Products"}</strong><span>{loading ? "Loading offers…" : `${items.length} loaded`}</span></div>
      {error && <ExperienceState kind="error" title="Marketplace isn't available right now." description={error} action={{label:"Try again",onClick:()=>void browse(tab)}} />}
      {!error && loading && <ExperienceState kind="loading" title="Loading currently published offers…" description="Checking availability and matching your filters." />}
      {!error && !loading && items.length === 0 && <ExperienceState kind="empty" title={meta.zeroResults ? "No matching offers." : "Nothing published here yet."} description={meta.zeroResults ? "Clear a filter or broaden the category or location." : "Explore another category, or come back as Hustlers add work and products."} action={{label:"Reset filters",onClick:()=>{setFilters(emptyFilters);setQuery("");setError(null);}}} />}
      {!loading && items.length > 0 && <div className={styles.grid}>{items.map((item, index) => <ResultCard key={`${item.kind}-${item.id}`} item={item} onOpen={() => openResult(item, index)} />)}</div>}
      {!loading && !error && meta.hasMore && <div className={styles.loadMore}><button className={styles.primaryButton} type="button" disabled={loadingMore} onClick={() => void browse(tab, meta.nextCursor, true)}>{loadingMore ? "Loading…" : "Load more"}</button></div>}
    </section>
  </main>;
}
