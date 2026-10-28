"use client";

import { ExperienceHeader } from "../../components/navigation/experience-header";
import Link from "next/link";
import { ExploreNearby, ExploreTypeahead, ExploreNoMatch } from "./explore-enhancements";
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
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [items, setItems] = useState<SearchResult[]>([]);
  const [meta, setMeta] = useState<Pick<SearchPage, "nextCursor" | "hasMore" | "zeroResults">>({ nextCursor: null, hasMore: false, zeroResults: false });
  const [sessionId, setSessionId] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const searchGroup = useRef<HTMLDivElement|null>(null);
  const [suggestOpen,setSuggestOpen]=useState(false);
  const [relatedResults,setRelatedResults]=useState<SearchResult[]>([]);
  useEffect(()=>{
    const outside=(e:PointerEvent)=>{
      if(e.target instanceof Node && searchGroup.current && !searchGroup.current.contains(e.target))setSuggestOpen(false);
    };
    const escape=(e:KeyboardEvent)=>{if(e.key==="Escape")setSuggestOpen(false);};
    document.addEventListener("pointerdown",outside);
    document.addEventListener("keydown",escape);
    return ()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
  },[]);
  function chooseSuggestion(term:string){
    setQuery(term);setSuggestOpen(false);setTab("top");
    setItems([]);setRelatedResults([]);
    setMeta({nextCursor:null,hasMore:false,zeroResults:false});
    void runSearch("top",null,false,emptyFilters,term);
  }

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

  async function runSearch(nextTab: SearchTab, cursor: string | null = null, append = false, appliedFilters: SearchFilters = filters, term: string = query) {
    const normalized = term.trim();
    if (!normalized) {
      setError("Enter what you need to find on Hustle.");
      return;
    }

    const version = append ? requestVersion.current : ++requestVersion.current;
    if(!append) {setRelatedResults([]);setSuggestOpen(false);}

    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const page = await getSearchPage(nextTab, { q: normalized, cursor, limit: 12, filters: appliedFilters });
      if (version !== requestVersion.current) return;
      setItems((current) => append ? [...current, ...page.items] : page.items);
      setMeta({ nextCursor: page.nextCursor, hasMore: page.hasMore, zeroResults: page.zeroResults });
      setSearchedQuery(normalized);
      if(!append && page.zeroResults && nextTab!=="top") {
        // Show real cross-type matches for the SAME term only, with their true
        // kind and publisher. Never invent "similar" people.
        void getSearchPage("top",{q:normalized,limit:6,filters:appliedFilters})
          .then(other=>{if(version===requestVersion.current)setRelatedResults(other.items);})
          .catch(()=>undefined);
      }

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
      // Keep a visible sign-in action; never redirect users unexpectedly while they read an error.
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setItems([]);setRelatedResults([]);
    setMeta({ nextCursor: null, hasMore: false, zeroResults: false });
    void runSearch(tab);
  }

  function switchTab(nextTab: SearchTab) {
    setTab(nextTab);
    if (!query.trim()) return;
    setItems([]);setRelatedResults([]);
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
  const activeFilterCount = Object.values(filters).filter((value) => value !== "" && value !== false && value !== null && value !== undefined).length;

  return <main className={[styles.shell,styles.searchExperience,"h-experience-shell"].join(" ")}>
    <ExperienceHeader section="Search" />

    <section className={[styles.hero, "h-experience-hero"].join(" ")}>
      <div className={styles.exploreTitleRow}><h1 className={styles.pwaExploreTitle}>Explore</h1>
        <Link className={styles.exploreAccount} href="/account" aria-label="Your Hustle account">◉</Link>
      </div>
      <p className={styles.pwaExploreSubtitle}>Discover people who can get it done.</p>
      <p className={styles.eyebrow}>INTENTIONAL DISCOVERY</p>
      <h1 className="h-experience-heading">Find who or what can genuinely help.</h1>
      <p>Search people by capability, inspect proof, and move directly into a published Service, Product or professional identity.</p>
    </section>

    <div className={styles.searchInputGroup} ref={searchGroup}>
      <form className={[styles.searchForm, "h-experience-content"].join(" ")} onSubmit={submit}>
        <div className={styles.searchBar} role="search">
          <span className={styles.searchGlyph} aria-hidden="true">⌕</span>
          <input type="search" autoComplete="off" enterKeyHint="search" value={query}
            onFocus={()=>setSuggestOpen(true)} onChange={(event)=>{
              setQuery(event.target.value);setSuggestOpen(true);if(error)setError(null);
            }} placeholder="Search skills, people, services…" aria-label="Search Hustle"
            aria-controls="hustle-explore-suggestions" aria-expanded={suggestOpen} aria-autocomplete="list"/>
          <button type="submit" className={styles.searchSubmit} disabled={loading || !query.trim()} aria-busy={loading}>
            <span className={styles.searchButtonLabel}>{loading ? "Searching…" : "Search Hustle"}</span>
            <span aria-hidden="true" className={styles.searchButtonShort}>{loading ? "…" : "Search"}</span>
          </button>
        </div>
      </form>
      <ExploreTypeahead value={query} visible={suggestOpen} onChoose={chooseSuggestion}
        onDismiss={()=>setSuggestOpen(false)}/>
    </div>
    <p className={styles.exploreTagline}>Discover people who can get it done.</p>

    <nav className={styles.pwaSkills} aria-label="Explore skills">
      {([
        ["Beauty", "✂", "beauty"],
        ["Fashion", "◈", "fashion"],
        ["Home", "⌂", "home services"],
        ["Media", "◉", "media"],
        ["Digital", "✦", "digital"]
      ] as const).map(([label, symbol, term]) =>
        <button key={label} type="button" className={query.trim().toLowerCase() === term ? styles.selectedSkill : ""} aria-pressed={query.trim().toLowerCase() === term} disabled={loading} onClick={() => {
          setQuery(term); setTab("top"); setFilters(emptyFilters); setError(null);
          setItems([]); setMeta({ nextCursor: null, hasMore: false, zeroResults: false });
          void runSearch("top", null, false, emptyFilters, term);
        }}>
          <span aria-hidden="true">{symbol}</span><small>{label}</small>
        </button>
      )}
    </nav>
    <ExploreNearby visible={!query.trim() && !searchedQuery && !loading && !error}/>
    {(Boolean(searchedQuery) || loading) && <div className={[styles.tabs, "h-experience-content"].join(" ")}>{tabs.map((item) => <button key={item.id} type="button" className={`${styles.tab} ${tab === item.id ? styles.tabActive : ""}`} aria-pressed={tab === item.id} onClick={() => switchTab(item.id)}>{item.label}</button>)}</div>}

    {(Boolean(searchedQuery) || loading) && <button type="button" className={styles.filterToggle} aria-expanded={filtersExpanded}
      aria-controls="hustle-explore-filters" onClick={() => setFiltersExpanded(open => !open)}>
      <span>Refine results{activeFilterCount ? ` · ${activeFilterCount} applied` : ""}</span>
      <span aria-hidden="true">{filtersExpanded ? "−" : "+"}</span>
    </button>}
    <section id="hustle-explore-filters" className={`${styles.filters} ${filtersExpanded ? styles.filtersOpen : ""}`}
      aria-label="Search filters">
      <input aria-label="Filter by category" placeholder="Category" value={filters.category ?? ""} onChange={(event) => setFilters({ ...filters, category: event.target.value })} />
      <input aria-label="Filter by skill" placeholder="Skill" value={filters.skill ?? ""} onChange={(event) => setFilters({ ...filters, skill: event.target.value })} />
      <input aria-label="Filter by location" placeholder="Location" value={filters.location ?? ""} onChange={(event) => setFilters({ ...filters, location: event.target.value })} />
      <input aria-label="Minimum price in naira" placeholder="Min price ₦" inputMode="numeric" value={filters.minPrice ?? ""} onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })} />
      <input aria-label="Maximum price in naira" placeholder="Max price ₦" inputMode="numeric" value={filters.maxPrice ?? ""} onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })} />
      <select aria-label="Filter by verification" value={filters.verified ?? ""} onChange={(event) => setFilters({ ...filters, verified: event.target.value })}><option value="">Any verification</option><option value="true">Verified only</option><option value="false">Unverified only</option></select>
      <select aria-label="Filter by service delivery" value={filters.deliveryMode ?? ""} onChange={(event) => setFilters({ ...filters, deliveryMode: event.target.value })}><option value="">Any service delivery</option><option value="REMOTE">Remote</option><option value="PHYSICAL">Physical</option><option value="BOTH">Both</option></select>
      <select aria-label="Filter by product type" value={filters.productType ?? ""} onChange={(event) => setFilters({ ...filters, productType: event.target.value })}><option value="">Any product type</option><option value="PHYSICAL">Physical product</option><option value="DIGITAL">Digital product</option></select>
      <label className={styles.checkField}><input type="checkbox" checked={Boolean(filters.nearby)} onChange={(event) => setFilters({ ...filters, nearby: event.target.checked })} /> Nearby me</label>
      <button className={styles.primaryButton} type="button" onClick={() => { setFiltersExpanded(false); void runSearch(tab); }} disabled={loading || !query.trim()}>Apply filters</button>
      <button className={styles.resetButton} type="button" disabled={loading} onClick={() => { setFilters(emptyFilters); setError(null); if (query.trim()) void runSearch(tab, null, false, emptyFilters); }}>Clear filters</button>
    </section>

    {(Boolean(searchedQuery) || loading || Boolean(error)) && <section className={[styles.resultsWrap, "h-experience-content"].join(" ")}>
      <div className={styles.resultMeta} role="status" aria-live="polite"><strong>{resultLabel}</strong><span>{loading ? "Searching…" : `${items.length} loaded · ${tab}`}</span></div>
      {error && <ExperienceState kind="error"
        title={/sign in|authentication is not configured/i.test(error) ? "Sign in to search Hustle." : "Search isn't available right now."}
        description={error}
        action={/sign in|authentication is not configured/i.test(error)
          ? { label: "Open test sign-in", href: "/auth" }
          : { label: "Retry search", onClick: () => void runSearch(tab), disabled: loading || !query.trim() }} />}
      {!error && loading && <ExperienceState kind="loading" title="Finding people, work and offers…" description="Checking currently published Hustle results." />}
      {!error && !loading && meta.zeroResults && <div className={styles.noMatchWrap}>
        <ExploreNoMatch term={searchedQuery} related={relatedResults} onSearch={chooseSuggestion}/>
        {activeFilterCount>0 && <button type="button" className={styles.resetButton} onClick={()=>{
          setFilters(emptyFilters);void runSearch(tab,null,false,emptyFilters);
        }}>Clear filters</button>}
        {relatedResults.length>0 && <div className={styles.grid}>{relatedResults.map((item,index)=>
          <ResultCard key={item.kind+"-"+item.id} item={item} onOpen={()=>openResult(item,index)}/>)}</div>}
      </div>}
      {!error && !loading && !meta.zeroResults && items.length === 0 && (Boolean(query.trim()) || Boolean(searchedQuery)) && <ExperienceState kind="empty" title="What do you need?" description="Search for a professional, service, product or work." />}
      {!loading && items.length > 0 && <div className={styles.grid}>{items.map((item, index) => <ResultCard key={`${item.kind}-${item.id}`} item={item} onOpen={() => openResult(item, index)} />)}</div>}
      {!loading && !error && meta.hasMore && <div className={styles.loadMore}><button className={styles.primaryButton} type="button" disabled={loadingMore} onClick={() => void runSearch(tab, meta.nextCursor, true)}>{loadingMore ? "Loading…" : "Load more"}</button></div>}
    </section>}
  </main>;
}
