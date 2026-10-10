"use client";

import { ExperienceHeader } from "../../components/navigation/experience-header";
import { ExperienceState } from "../../components/experience/experience-state";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  const requestVersion = useRef(0);

  useEffect(() => {
    setSessionId(createSessionId());
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q")?.trim() ?? "";
    if (initial) setQuery(initial);
  }, []);

  // A shared search link may open /search?q=... from another Hustle page.
  // Run that initial intent once, after session + URL state have hydrated.
  useEffect(() => {
    if (!sessionId || !query.trim()) return;
    void runSearch("top");
    // Do not auto-search on every keystroke: explicit submit and Apply control it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function runSearch(nextTab: SearchTab, cursor: string | null = null, append = false, appliedFilters: SearchFilters = filters) {
    const normalized = query.trim();
    if (!normalized) {
      setError("Enter what you need to find on Hustle.");
      return;
    }

    const version = append ? requestVersion.current : ++requestVersion.current;
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const page = await getSearchPage(nextTab, { q: normalized, cursor, limit: 12, filters: appliedFilters });
      if (version !== requestVersion.current) return;
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
      if (version !== requestVersion.current) return;
      const message = reason instanceof Error ? reason.message : "Search failed";
      setError(message);
      if (message.toLowerCase().includes("sign in")) setTimeout(() => window.location.assign("/auth"), 900);
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
        setLoadingMore(false);
      }
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
    if (!sessionId) return Promise.resolve();
    return captureSearchObservation("search.result_clicked", {
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

  return <main className={[styles.shell, "h-experience-shell"].join(" ")}>
    <ExperienceHeader section="Search" />

    <section className={[styles.hero, "h-experience-hero"].join(" ")}>
      <p className={styles.eyebrow}>INTENTIONAL DISCOVERY</p>
      <h1 className="h-experience-heading">Find who or what can genuinely help.</h1>
      <p>Search people by capability, inspect proof, and move directly into a published Service, Product or professional identity.</p>
    </section>

    <form className={[styles.searchForm, "h-experience-content"].join(" ")} onSubmit={submit}>
      <div className={styles.searchBar} role="search">
        <input type="search" autoComplete="off" enterKeyHint="search" value={query} onChange={(event) => { setQuery(event.target.value); if (error) setError(null); }} placeholder="Try: full stack developer Lagos" aria-label="Search Hustle" />
        <button type="submit" disabled={loading || !query.trim()} aria-busy={loading}>{loading ? "Searching…" : "Search Hustle"}</button>
      </div>
    </form>

    <div className={[styles.tabs, "h-experience-content"].join(" ")}>{tabs.map((item) => <button key={item.id} type="button" className={`${styles.tab} ${tab === item.id ? styles.tabActive : ""}`} aria-pressed={tab === item.id} onClick={() => switchTab(item.id)}>{item.label}</button>)}</div>

    <section className={styles.filters} aria-label="Search filters">
      <input aria-label="Filter by category" placeholder="Category" value={filters.category ?? ""} onChange={(event) => setFilters({ ...filters, category: event.target.value })} />
      <input aria-label="Filter by skill" placeholder="Skill" value={filters.skill ?? ""} onChange={(event) => setFilters({ ...filters, skill: event.target.value })} />
      <input aria-label="Filter by location" placeholder="Location" value={filters.location ?? ""} onChange={(event) => setFilters({ ...filters, location: event.target.value })} />
      <input aria-label="Minimum price in naira" placeholder="Min price ₦" inputMode="numeric" value={filters.minPrice ?? ""} onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })} />
      <input aria-label="Maximum price in naira" placeholder="Max price ₦" inputMode="numeric" value={filters.maxPrice ?? ""} onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })} />
      <select aria-label="Filter by verification" value={filters.verified ?? ""} onChange={(event) => setFilters({ ...filters, verified: event.target.value })}><option value="">Any verification</option><option value="true">Verified only</option><option value="false">Unverified only</option></select>
      <select aria-label="Filter by service delivery" value={filters.deliveryMode ?? ""} onChange={(event) => setFilters({ ...filters, deliveryMode: event.target.value })}><option value="">Any service delivery</option><option value="REMOTE">Remote</option><option value="PHYSICAL">Physical</option><option value="BOTH">Both</option></select>
      <select aria-label="Filter by product type" value={filters.productType ?? ""} onChange={(event) => setFilters({ ...filters, productType: event.target.value })}><option value="">Any product type</option><option value="PHYSICAL">Physical product</option><option value="DIGITAL">Digital product</option></select>
      <label className={styles.checkField}><input type="checkbox" checked={Boolean(filters.nearby)} onChange={(event) => setFilters({ ...filters, nearby: event.target.checked })} /> Nearby me</label>
      <button className={styles.primaryButton} type="button" onClick={() => void runSearch(tab)} disabled={loading || !query.trim()}>Apply filters</button>
      <button className={styles.resetButton} type="button" disabled={loading} onClick={() => { setFilters(emptyFilters); setError(null); if (query.trim()) void runSearch(tab, null, false, emptyFilters); }}>Clear filters</button>
    </section>

    <section className={[styles.resultsWrap, "h-experience-content"].join(" ")}>
      <div className={styles.resultMeta} role="status" aria-live="polite"><strong>{resultLabel}</strong><span>{loading ? "Searching…" : `${items.length} loaded · ${tab}`}</span></div>
      {error && <ExperienceState kind="error" title="Search isn't available right now." description={error} action={{ label: "Retry search", onClick: () => void runSearch(tab), disabled: loading || !query.trim() }} />}
      {!error && loading && <ExperienceState kind="loading" title="Finding people, work and offers…" description="Checking currently published Hustle results." />}
      {!error && !loading && meta.zeroResults && <ExperienceState kind="empty" title="No useful match yet." description="Try a broader skill, category or location. Hustle won't silently substitute unrelated results." action={{label:"Clear filters",onClick:()=>{setFilters(emptyFilters);setError(null);if(query.trim())void runSearch(tab,null,false,emptyFilters);}}} />}
      {!error && !loading && !meta.zeroResults && items.length === 0 && <ExperienceState kind="empty" title="What do you need?" description="Search for a professional, capability, Service, Product or demonstrated work." />}
      {!loading && items.length > 0 && <div className={styles.grid}>{items.map((item, index) => <ResultCard key={`${item.kind}-${item.id}`} item={item} onOpen={() => openResult(item, index)} />)}</div>}
      {!loading && !error && meta.hasMore && <div className={styles.loadMore}><button className={styles.primaryButton} type="button" disabled={loadingMore} onClick={() => void runSearch(tab, meta.nextCursor, true)}>{loadingMore ? "Loading…" : "Load more"}</button></div>}
    </section>
  </main>;
}
