"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  captureSearchObservation,
  getSearchPage,
  type SearchFilters,
  type SearchPage,
  type SearchResult,
  type SearchTab
} from "../../lib/search";
import { ResultCard } from "./result-card";
import styles from "./search.module.css";

const tabs: Array<{ id: SearchTab; label: string }> = [
  { id: "top", label: "Top" },
  { id: "people", label: "People" },
  { id: "posts", label: "Posts" },
  { id: "services", label: "Services" },
  { id: "products", label: "Products" }
];

function createSessionId() {
  const key = "hustle-search-session";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const next = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `search-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

export default function SearchPageScreen() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<SearchTab>("top");
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [items, setItems] = useState<SearchResult[]>([]);
  const [meta, setMeta] = useState<Pick<SearchPage, "nextCursor" | "hasMore" | "zeroResults">>({ nextCursor: null, hasMore: false, zeroResults: false });
  const [sessionId, setSessionId] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(createSessionId());
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q")?.trim() ?? "";
    if (initial) setQuery(initial);
  }, []);

  async function runSearch(nextTab: SearchTab, cursor: string | null = null, append = false) {
    const normalized = query.trim();
    if (!normalized) {
      setError("Enter what you need to find on Hustle.");
      return;
    }

    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const page = await getSearchPage(nextTab, { q: normalized, cursor, limit: 12, filters });
      setItems((current) => append ? [...current, ...page.items] : page.items);
      setMeta({ nextCursor: page.nextCursor, hasMore: page.hasMore, zeroResults: page.zeroResults });
      setSearchedQuery(normalized);

      if (!append) {
        const params = new URLSearchParams();
        params.set("q", normalized);
        window.history.replaceState(null, "", `/search?${params.toString()}`);
      }

      if (sessionId) {
        void captureSearchObservation("search.performed", {
          query: normalized,
          tab: nextTab,
          filters: page.filters,
          resultCount: page.items.length,
          sessionId
        }).catch(() => undefined);

        if (page.zeroResults) {
          void captureSearchObservation("search.zero_results", {
            query: normalized,
            tab: nextTab,
            filters: page.filters,
            resultCount: 0,
            sessionId
          }).catch(() => undefined);
        }
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Search failed";
      setError(message);
      if (message.toLowerCase().includes("sign in")) setTimeout(() => window.location.assign("/auth"), 900);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setItems([]);
    setMeta({ nextCursor: null, hasMore: false, zeroResults: false });
    void runSearch(tab);
  }

  function switchTab(nextTab: SearchTab) {
    setTab(nextTab);
    if (!query.trim()) return;
    setItems([]);
    setMeta({ nextCursor: null, hasMore: false, zeroResults: false });
    void runSearch(nextTab);
  }

  function openResult(item: SearchResult, position: number) {
    if (!sessionId) return;
    void captureSearchObservation("search.result_clicked", {
      query: searchedQuery || query.trim(),
      tab,
      filters: filters as Record<string, unknown>,
      resultType: item.kind,
      resultId: item.id,
      resultUrl: item.url,
      position,
      sessionId
    }).catch(() => undefined);
  }

  const resultLabel = useMemo(() => searchedQuery ? `Results for “${searchedQuery}”` : "Search across Hustle", [searchedQuery]);

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="/">HUSTLE<span>↗</span></a>
      <nav className={styles.headerNav}><a href="/home">Home</a><a href="/marketplace">Marketplace</a><a href="/account">Your identity</a></nav>
    </header>

    <section className={styles.hero}>
      <p className={styles.eyebrow}>INTENTIONAL DISCOVERY</p>
      <h1>Find who or what can genuinely help.</h1>
      <p>Search people by capability, inspect proof, and move directly into a published Service, Product or professional identity.</p>
    </section>

    <form className={styles.searchForm} onSubmit={submit}>
      <div className={styles.searchBar}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try: full stack developer Lagos" aria-label="Search Hustle" />
        <button type="submit" disabled={loading}>{loading ? "Searching…" : "Search Hustle"}</button>
      </div>
    </form>

    <div className={styles.tabs}>{tabs.map((item) => <button key={item.id} type="button" className={`${styles.tab} ${tab === item.id ? styles.tabActive : ""}`} onClick={() => switchTab(item.id)}>{item.label}</button>)}</div>

    <section className={styles.filters} aria-label="Search filters">
      <input placeholder="Category" value={filters.category ?? ""} onChange={(event) => setFilters({ ...filters, category: event.target.value })} />
      <input placeholder="Skill" value={filters.skill ?? ""} onChange={(event) => setFilters({ ...filters, skill: event.target.value })} />
      <input placeholder="Location" value={filters.location ?? ""} onChange={(event) => setFilters({ ...filters, location: event.target.value })} />
      <input placeholder="Min price ₦" inputMode="numeric" value={filters.minPrice ?? ""} onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })} />
      <input placeholder="Max price ₦" inputMode="numeric" value={filters.maxPrice ?? ""} onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })} />
      <select value={filters.verified ?? ""} onChange={(event) => setFilters({ ...filters, verified: event.target.value })}><option value="">Any verification</option><option value="true">Verified only</option><option value="false">Unverified only</option></select>
      <select value={filters.deliveryMode ?? ""} onChange={(event) => setFilters({ ...filters, deliveryMode: event.target.value })}><option value="">Any service delivery</option><option value="REMOTE">Remote</option><option value="PHYSICAL">Physical</option><option value="BOTH">Both</option></select>
      <select value={filters.productType ?? ""} onChange={(event) => setFilters({ ...filters, productType: event.target.value })}><option value="">Any product type</option><option value="PHYSICAL">Physical product</option><option value="DIGITAL">Digital product</option></select>
      <label className={styles.checkField}><input type="checkbox" checked={Boolean(filters.nearby)} onChange={(event) => setFilters({ ...filters, nearby: event.target.checked })} /> Nearby me</label>
      <button className={styles.primaryButton} type="button" onClick={() => void runSearch(tab)} disabled={loading || !query.trim()}>Apply filters</button>
    </section>

    <section className={styles.resultsWrap}>
      <div className={styles.resultMeta}><strong>{resultLabel}</strong><span>{items.length} loaded · {tab}</span></div>
      {error && <div className={styles.error}>{error}</div>}
      {!error && loading && <div className={styles.loading}>Matching intent to current public capability…</div>}
      {!error && !loading && meta.zeroResults && <div className={styles.empty}><strong>No useful match yet.</strong><span>Try a broader skill, category or location. Hustle will not silently substitute unrelated results.</span></div>}
      {!error && !loading && !meta.zeroResults && items.length === 0 && <div className={styles.empty}><strong>What do you need?</strong><span>Search for a professional, capability, Service, Product or demonstrated work.</span></div>}
      {items.length > 0 && <div className={styles.grid}>{items.map((item, index) => <ResultCard key={`${item.kind}-${item.id}`} item={item} onOpen={() => openResult(item, index)} />)}</div>}
      {meta.hasMore && <div className={styles.loadMore}><button className={styles.primaryButton} type="button" disabled={loadingMore} onClick={() => void runSearch(tab, meta.nextCursor, true)}>{loadingMore ? "Loading…" : "Load more"}</button></div>}
    </section>
  </main>;
}
