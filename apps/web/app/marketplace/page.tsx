"use client";

import { FormEvent, useEffect, useState } from "react";
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

  useEffect(() => {
    setSessionId(createSessionId());
  }, []);

  async function browse(nextTab: MarketplaceTab, cursor: string | null = null, append = false) {
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const page = await getMarketplacePage(nextTab, { q: query, cursor, limit: 12, filters });
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
      const message = reason instanceof Error ? reason.message : "Marketplace failed to load";
      setError(message);
      if (message.toLowerCase().includes("sign in")) setTimeout(() => window.location.assign("/auth"), 900);
    } finally {
      setLoading(false);
      setLoadingMore(false);
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

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="/">HUSTLE<span>↗</span></a>
      <nav className={styles.headerNav}><a href="/home">Home</a><a href="/search">Search</a><a href="/account">Your identity</a></nav>
    </header>

    <section className={styles.hero}>
      <div className={styles.browseIntro}>
        <div><p className={styles.eyebrow}>MARKETPLACE</p><h1>Browse current economic opportunities.</h1></div>
        <a href="/search">Need something specific? Search →</a>
      </div>
      <p>Services and Products stay attached to the same professional identities and proof that created them.</p>
    </section>

    <form className={styles.searchForm} onSubmit={submit}>
      <div className={styles.searchBar}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Optional: narrow marketplace by keyword" aria-label="Narrow marketplace" />
        <button type="submit" disabled={loading}>{loading ? "Loading…" : "Browse"}</button>
      </div>
    </form>

    <div className={styles.tabs}>{tabs.map((item) => <button key={item.id} type="button" className={`${styles.tab} ${tab === item.id ? styles.tabActive : ""}`} onClick={() => switchTab(item.id)}>{item.label}</button>)}</div>

    <section className={styles.filters} aria-label="Marketplace filters">
      <input placeholder="Category" value={filters.category ?? ""} onChange={(event) => setFilters({ ...filters, category: event.target.value })} />
      <input placeholder="Skill" value={filters.skill ?? ""} onChange={(event) => setFilters({ ...filters, skill: event.target.value })} />
      <input placeholder="Location" value={filters.location ?? ""} onChange={(event) => setFilters({ ...filters, location: event.target.value })} />
      <input placeholder="Min price ₦" inputMode="numeric" value={filters.minPrice ?? ""} onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })} />
      <input placeholder="Max price ₦" inputMode="numeric" value={filters.maxPrice ?? ""} onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })} />
      <select value={filters.verified ?? ""} onChange={(event) => setFilters({ ...filters, verified: event.target.value })}><option value="">Any verification</option><option value="true">Verified sellers</option><option value="false">Unverified sellers</option></select>
      <select value={filters.deliveryMode ?? ""} onChange={(event) => setFilters({ ...filters, deliveryMode: event.target.value })}><option value="">Any service delivery</option><option value="REMOTE">Remote</option><option value="PHYSICAL">Physical</option><option value="BOTH">Both</option></select>
      <select value={filters.productType ?? ""} onChange={(event) => setFilters({ ...filters, productType: event.target.value })}><option value="">Any product type</option><option value="PHYSICAL">Physical product</option><option value="DIGITAL">Digital product</option></select>
      <label className={styles.checkField}><input type="checkbox" checked={Boolean(filters.nearby)} onChange={(event) => setFilters({ ...filters, nearby: event.target.checked })} /> Nearby me</label>
      <button className={styles.primaryButton} type="button" disabled={loading} onClick={() => void browse(tab)}>Apply filters</button>
    </section>

    <section className={styles.resultsWrap}>
      <div className={styles.resultMeta}><strong>{tab === "all" ? "Marketplace" : tab === "services" ? "Services" : "Products"}</strong><span>{items.length} loaded</span></div>
      {error && <div className={styles.error}>{error}</div>}
      {!error && loading && <div className={styles.loading}>Loading current published offers…</div>}
      {!error && !loading && meta.zeroResults && <div className={styles.empty}><strong>No matching offers.</strong><span>Clear a filter or broaden the category/location range.</span></div>}
      {items.length > 0 && <div className={styles.grid}>{items.map((item, index) => <ResultCard key={`${item.kind}-${item.id}`} item={item} onOpen={() => openResult(item, index)} />)}</div>}
      {meta.hasMore && <div className={styles.loadMore}><button className={styles.primaryButton} type="button" disabled={loadingMore} onClick={() => void browse(tab, meta.nextCursor, true)}>{loadingMore ? "Loading…" : "Load more"}</button></div>}
    </section>
  </main>;
}
