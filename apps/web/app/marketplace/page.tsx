"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExperienceHeader } from "../../components/navigation/experience-header";
import { ExperienceState } from "../../components/experience/experience-state";
import {
  captureMarketplaceObservation,
  getMarketplacePage,
  type MarketplaceTab,
  type SearchFilters,
  type SearchPage,
  type SearchResult
} from "../../lib/search";
import { marketplaceModeFilters, marketplaceRoute, marketplaceView } from "../../lib/marketplace-focus";
import { MarketplaceOfferCard, type Offer } from "./marketplace-offer-card";
import styles from "./marketplace.module.css";

const modes: ReadonlyArray<{ id: MarketplaceTab; label: string; short: string }> = [
  { id: "all", label: "Everything", short: "All" },
  { id: "services", label: "Services & Skills", short: "Hire" },
  { id: "products", label: "Products", short: "Shop" }
];
function firstPublishedServicePhoto(items: Offer[]): string | null {
  for (const item of items) {
    if (item.kind !== "service") continue;
    const image = item.service.mediaUrls?.find((url) => !/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url));
    if (image) return image;
  }
  return null;
}

function categorySymbol(category: string) {
  const value = category.toLowerCase();
  if (/beauty|hair|makeup|barb|salon/.test(value)) return "✂";
  if (/home|clean|repair|furniture|plumb/.test(value)) return "⌂";
  if (/tech|digital|software|website|computer/.test(value)) return "▣";
  if (/fashion|style|tailor|cloth/.test(value)) return "♧";
  if (/wellness|fitness|health|yoga/.test(value)) return "♡";
  if (/food|cook|bake/.test(value)) return "◒";
  if (/art|creative|photo|video/.test(value)) return "✦";
  return "◇";
}

const clearFilters: SearchFilters = {
  category: "", skill: "", location: "", nearby: false, minPrice: "", maxPrice: "",
  verified: "", deliveryMode: "", productType: ""
};

type Slice = { items: Offer[]; nextCursor: string | null; hasMore: boolean };
type OfferSlices = { services: Slice; products: Slice };
const emptySlice = (): Slice => ({ items: [], nextCursor: null, hasMore: false });
const emptySlices = (): OfferSlices => ({ services: emptySlice(), products: emptySlice() });

function offersOf(page: SearchPage, kind: Offer["kind"]): Offer[] {
  return page.items.filter((item): item is Offer =>
    item.kind === kind
  );
}
function getSessionId() {
  const key = "hustle-marketplace-session";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const next = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID() : `marketplace-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem(key, next);
  return next;
}

export default function MarketplacePage() {
  const [view, setView] = useState<MarketplaceTab>("all");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(clearFilters);
  const [activeQuery, setActiveQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<SearchFilters>(clearFilters);
  const [slices, setSlices] = useState<OfferSlices>(emptySlices);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState("");
  const requestVersion = useRef(0);

  async function browse(
    nextView: MarketplaceTab,
    nextFilters: SearchFilters,
    nextQuery: string,
    session: string,
    cursor: string | null = null,
    append = false
  ) {
    const version = append ? requestVersion.current : ++requestVersion.current;
    if (append) setLoadingMore(true);
    else { setLoading(true); setSlices(emptySlices()); }
    setError(null);

    try {
      let next: OfferSlices;
      if (nextView === "all") {
        // A ranked mixed page may contain only one type. Fetch each actual
        // publication endpoint to guarantee honest representation of BOTH.
        const [services, products] = await Promise.all([
          getMarketplacePage("services", { q: nextQuery, filters: nextFilters, limit: 6 }),
          getMarketplacePage("products", { q: nextQuery, filters: nextFilters, limit: 6 })
        ]);
        next = {
          services: { items: offersOf(services, "service"), nextCursor: services.nextCursor, hasMore: services.hasMore },
          products: { items: offersOf(products, "product"), nextCursor: products.nextCursor, hasMore: products.hasMore }
        };
      } else {
        const result = await getMarketplacePage(nextView, {
          q: nextQuery, filters: nextFilters, limit: 12, cursor
        });
        const selected: Slice = {
          items: offersOf(result, nextView === "services" ? "service" : "product"),
          nextCursor: result.nextCursor,
          hasMore: result.hasMore
        };
        next = nextView === "services"
          ? { services: selected, products: emptySlice() }
          : { services: emptySlice(), products: selected };
      }
      if (version !== requestVersion.current) return;
      setSlices((previous) => append && nextView !== "all" ? {
        ...previous,
        [nextView]: {
          ...next[nextView],
          items: [...previous[nextView].items, ...next[nextView].items]
        }
      } : next);
      setActiveQuery(nextQuery.trim());
      setActiveFilters(nextFilters);
      if (!append && session) {
        void captureMarketplaceObservation("marketplace.viewed", {
          query: nextQuery.trim() || null, tab: nextView, filters: nextFilters as Record<string, unknown>,
          resultCount: next.services.items.length + next.products.items.length, sessionId: session
        }).catch(() => undefined);
      }
    } catch (reason) {
      if (version === requestVersion.current) setError(reason instanceof Error ? reason.message : "Marketplace failed to load");
    } finally {
      if (version === requestVersion.current) { setLoading(false); setLoadingMore(false); }
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialView = marketplaceView(window.location.search);
    const initialQuery = params.get("q")?.trim() ?? "";
    const initialCategory = params.get("category")?.trim().slice(0,100) ?? "";
    const initialFilters = { ...clearFilters, category: initialCategory };
    const id = getSessionId();
    setSessionId(id);
    setView(initialView);
    setQuery(initialQuery);
    setFilters(initialFilters);
    void browse(initialView, initialFilters, initialQuery, id);
    // Hydrate shared marketplace links just once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateView(nextView: MarketplaceTab) {
    if (nextView === view) return;
    const nextFilters = marketplaceModeFilters(nextView, activeFilters);
    setView(nextView);
    setFilters(nextFilters);
    window.history.replaceState(null, "", marketplaceRoute(nextView, activeQuery, nextFilters.category ?? ""));
    void browse(nextView, nextFilters, activeQuery, sessionId);
  }

  function applyFilters(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const next = marketplaceModeFilters(view, filters);
    window.history.replaceState(null, "", marketplaceRoute(view, query, next.category ?? ""));
    void browse(view, next, query, sessionId);
    setFilterOpen(false);
  }

  function chooseCategory(category: string) {
    const next = marketplaceModeFilters(view, { ...activeFilters, category });
    setFilters(next);
    window.history.replaceState(null, "", marketplaceRoute(view, activeQuery, category));
    void browse(view, next, activeQuery, sessionId);
  }

  function reset() {
    const next = { ...clearFilters };
    setFilters(next); setQuery("");
    window.history.replaceState(null, "", marketplaceRoute(view, "", ""));
    void browse(view, next, "", sessionId);
    setFilterOpen(false);
  }

  function recordOpen(item: Offer, position: number) {
    if (!sessionId) return;
    void captureMarketplaceObservation("marketplace.result_clicked", {
      query: activeQuery || null, tab: view, filters: activeFilters as Record<string, unknown>,
      resultType: item.kind, resultId: item.id, resultUrl: item.url, position, sessionId
    }).catch(() => undefined);
  }

  const visibleItems = useMemo(() => [
    ...slices.services.items, ...slices.products.items
  ], [slices]);
  const categories = useMemo(() => {
    // Only categories belonging to actual published results currently loaded.
    const live = visibleItems.map(item => item.kind === "service" ? item.service.category : item.product.category)
      .filter((value): value is string => Boolean(value?.trim()));
    return Array.from(new Set([activeFilters.category?.trim() ?? "", ...live].filter(Boolean))).slice(0,8);
  }, [visibleItems, activeFilters.category]);
  const bannerPhoto = useMemo(() => firstPublishedServicePhoto(slices.services.items), [slices.services.items]);
  const count = visibleItems.length;
  const noResults = !loading && !error && count === 0;

  return <main className={styles.shell} data-hustle-marketplace="true">
    <ExperienceHeader section="Marketplace" />
    <header className={styles.marketHero}>
      <div className={styles.mobileTopbar}>
        <Link href="/home" aria-label="Hustle home">Hustle<span aria-hidden="true">✳</span></Link>
        <Link className={styles.accountShortcut} href="/account" aria-label="Your Hustle account">
          <span aria-hidden="true">◉</span>
        </Link>
      </div>
      <div className={styles.marketIdentity}>
        {view === "all" ? <p>Find local talent, services and unique products.</p> :
          <h1 className={styles.focusHeading}>{view === "services" ? "Services & Skills" : "Products"}</h1>}
      </div>
      <form className={styles.findForm} role="search" onSubmit={applyFilters}>
        <label className={styles.searchInput}>
          <span aria-hidden="true">⌕</span>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder={view === "services" ? "Search skills or services" : view === "products" ? "Search products" : "Search services and products"}
            aria-label="Search marketplace" enterKeyHint="search" />
        </label>
        <button className={styles.searchSubmit} type="submit">Search</button>
      </form>
      <div className={styles.modeTabs} role="group" aria-label="Marketplace modes">
        {modes.map(mode => <button key={mode.id} type="button"
          aria-pressed={view === mode.id}
          className={view === mode.id ? styles.modeSelected : ""}
          onClick={() => updateView(mode.id)}>
          {mode.label}
        </button>)}
      </div>
    </header>

    <section className={styles.browseBar} aria-label="Choose marketplace browsing focus">
      <div className={styles.refinementRow}>
        <div className={styles.currentFocus}>
          <span>{view === "all" ? "Discover everything" : view === "services" ? "Hiring & services" : "Shopping & products"}</span>
          {activeQuery && <small>for “{activeQuery}”</small>}
        </div>
        <button type="button" className={styles.filterToggle}
          aria-expanded={filterOpen} aria-controls="marketplace-refine"
          onClick={() => setFilterOpen(open => !open)}>Refine results <span aria-hidden="true">{filterOpen ? "−" : "+"}</span></button>
      </div>

      {filterOpen && <form id="marketplace-refine" className={styles.filterPanel} onSubmit={applyFilters}>
        <label>Category<input value={filters.category ?? ""} onChange={e=>setFilters({...filters,category:e.target.value})} placeholder="e.g. Beauty, Technology" maxLength={100}/></label>
        {view === "services" && <label>Skill<input value={filters.skill ?? ""} onChange={e=>setFilters({...filters,skill:e.target.value})} placeholder="e.g. Hair styling" maxLength={100}/></label>}
        <label>Location<input value={filters.location ?? ""} onChange={e=>setFilters({...filters,location:e.target.value})} placeholder="e.g. Lagos" maxLength={120}/></label>
        <label>Min price (₦)<input type="number" min="0" inputMode="numeric" value={filters.minPrice ?? ""} onChange={e=>setFilters({...filters,minPrice:e.target.value})} placeholder="0"/></label>
        <label>Max price (₦)<input type="number" min="0" inputMode="numeric" value={filters.maxPrice ?? ""} onChange={e=>setFilters({...filters,maxPrice:e.target.value})} placeholder="Any"/></label>
        <label>Verification<select value={filters.verified ?? ""} onChange={e=>setFilters({...filters,verified:e.target.value})}><option value="">All sellers</option><option value="true">Contact verified</option><option value="false">Not contact verified</option></select></label>
        {view === "services" && <label>Delivery<select value={filters.deliveryMode ?? ""} onChange={e=>setFilters({...filters,deliveryMode:e.target.value})}><option value="">All delivery modes</option><option value="REMOTE">Remote</option><option value="PHYSICAL">In person</option><option value="BOTH">Both</option></select></label>}
        {view === "products" && <label>Product type<select value={filters.productType ?? ""} onChange={e=>setFilters({...filters,productType:e.target.value})}><option value="">All products</option><option value="PHYSICAL">Physical</option><option value="DIGITAL">Digital</option></select></label>}
        <label className={styles.nearby}><input type="checkbox" checked={Boolean(filters.nearby)} onChange={e=>setFilters({...filters,nearby:e.target.checked})} /> Nearby me <small>Requires an available account location or location filter</small></label>
        <div className={styles.filterActions}>
          <button className={styles.applyFilter} type="submit">Apply filters</button>
          <button className={styles.clearFilter} type="button" onClick={reset}>Clear everything</button>
        </div>
      </form>}

      {!loading && categories.length > 0 && <div className={styles.categoryRail} role="group" aria-label="Categories from loaded offers">
        <button type="button" aria-pressed={!activeFilters.category} onClick={()=>chooseCategory("")}>
          <span className={styles.categoryIcon} aria-hidden="true">✳</span><span>All</span>
        </button>
        {categories.map(category => <button type="button" key={category} aria-pressed={activeFilters.category === category}
          onClick={()=>chooseCategory(category)}>
          <span className={styles.categoryIcon} aria-hidden="true">{categorySymbol(category)}</span><span>{category}</span>
        </button>)}
        <button type="button" onClick={()=>setFilterOpen(true)} aria-label="More marketplace filters">
          <span className={styles.categoryIcon} aria-hidden="true">•••</span><span>More</span>
        </button>
      </div>}
    </section>

    <section className={styles.marketResults} aria-label="Published marketplace offers">
      {view === "all" && !loading && !error && !activeQuery && !activeFilters.category && <section className={styles.featureBanner} aria-label="Hustle marketplace introduction">
        <div className={styles.bannerCopy}>
          <span>SKILLS · PRODUCTS · REAL PEOPLE</span>
          <h1>Turn your talent into <em>opportunity.</em></h1>
          <p>Find people who can do the work, discover what they make, and support their hustle.</p>
          <button type="button" onClick={()=>updateView("services")}>Explore services <span aria-hidden="true">↗</span></button>
        </div>
        <div className={styles.bannerVisual} aria-hidden="true">
          {bannerPhoto ? <img src={bannerPhoto} alt="" loading="lazy" />
            : <span>H<span>✳</span></span>}
        </div>
      </section>}
      <div className={styles.resultsMeta} role="status" aria-live="polite">
        <strong>{view === "all" ? "Discover on Hustle" : view === "services" ? "Find your professional" : "Shop from Hustlers"}</strong>
        <span>{loading ? "Loading published offers…" : `${count} loaded`}</span>
      </div>
      {loading && <ExperienceState kind="loading" title="Finding published offers…" description="Loading live Hustle listings." />}
      {error && <ExperienceState kind="error" title="Couldn't load the marketplace." description={error}
        action={{ label:"Try again", onClick:()=>void browse(view,activeFilters,activeQuery,sessionId) }}/>}
      {noResults && <ExperienceState kind="empty" title="No matching offers yet."
        description="Try a broader category or location, or switch between services and products."
        action={{label:"Clear search and filters",onClick:reset}} />}

      {!loading && !error && view !== "products" && slices.services.items.length > 0 &&
        <section className={styles.marketSection} aria-label="Published services and skills">
          <div className={styles.sectionHeading}>
            <div><span className={styles.sectionKicker}>{view === "all" ? "SKILLS & PEOPLE" : "FIND THE RIGHT PROFESSIONAL"}</span><h2>{view === "all" ? "Featured Services" : "Services & Skills"}</h2></div>
            {view === "all" && <button type="button" onClick={()=>updateView("services")}>See all <span aria-hidden="true">↗</span></button>}
          </div>
          <div className={[styles.servicesGrid, slices.services.items.length === 1 ? styles.singleOfferGrid : ""].filter(Boolean).join(" ")}>{slices.services.items.map((item,index)=>
            <MarketplaceOfferCard key={item.kind+"-"+item.id} item={item} onOpen={offer=>recordOpen(offer,index)}/>)}</div>
        </section>}
      {!loading && !error && view !== "services" && slices.products.items.length > 0 &&
        <section className={styles.marketSection} aria-label="Published products">
          <div className={styles.sectionHeading}>
            <div><span className={styles.sectionKicker}>{view === "all" ? "SHOP LOCAL & CREATIVE" : "CURATED BY HUSTLERS"}</span><h2>{view === "all" ? "Featured Products" : "Products"}</h2></div>
            {view === "all" && <button type="button" onClick={()=>updateView("products")}>See all <span aria-hidden="true">↗</span></button>}
          </div>
          <div className={[styles.productsGrid, slices.products.items.length === 1 ? styles.singleProductGrid : ""].filter(Boolean).join(" ")}>{slices.products.items.map((item,index)=>
            <MarketplaceOfferCard key={item.kind+"-"+item.id} item={item} onOpen={offer=>recordOpen(offer,index)}/>)}</div>
        </section>}

      {!loading && !error && view === "all" && slices.services.items.length > 0 && slices.products.items.length === 0 &&
        <section className={styles.marketSection} aria-label="Products coming to the marketplace">
          <div className={styles.sectionHeading}>
            <div><span className={styles.sectionKicker}>MADE, FOUND & SOLD ON HUSTLE</span>
              <h2>Products</h2><p>Explore products published by Hustlers.</p></div>
          </div>
          <div className={styles.emptyProductNote}>
            <span aria-hidden="true">◈</span>
            <div><strong>No products published here yet</strong>
              <p>Products will appear as Hustlers publish them. There are no placeholder listings.</p></div>
            <button type="button" onClick={()=>updateView("products")}>Browse products ↗</button>
          </div>
        </section>}

      {!loading && !error && view !== "all" && slices[view].hasMore &&
        <div className={styles.moreRow}>
          <button type="button" disabled={loadingMore} onClick={() =>
            void browse(view,activeFilters,activeQuery,sessionId,slices[view].nextCursor,true)}>
            {loadingMore ? "Loading more…" : `Load more ${view}`}
          </button>
        </div>}

    </section>
  </main>;
}
