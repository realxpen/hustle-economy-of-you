"use client";

import type { SearchResult, SearchTab, ResultKind } from "../../lib/search";
import { ResultCard } from "./result-card";
import styles from "./search.module.css";

// The API remains the source of truth for ranking, publication and pagination.
// Only the presentation changes. A "Top" page keeps its original item positions
// for telemetry while rendering each content type in its own visual language.
const groups: ReadonlyArray<{ kind: ResultKind; tab: SearchTab; heading: string }> = [
  { kind: "person", tab: "people", heading: "People" },
  { kind: "post", tab: "posts", heading: "Posts" },
  { kind: "service", tab: "services", heading: "Services" },
  { kind: "product", tab: "products", heading: "Products" }
];

export function SearchResultCollection({
  items,
  tab,
  onOpen,
  onSelectTab
}: {
  items: SearchResult[];
  tab: SearchTab;
  onOpen: (item: SearchResult, index: number) => void | Promise<unknown>;
  onSelectTab: (tab: SearchTab) => void;
}) {
  const entries = items.map((item, index) => ({ item, index }));
  return <div className={styles.discoveryResults}>
    {groups.map(({ kind, tab: targetTab, heading }) => {
      const matches = entries.filter(({ item }) => item.kind === kind);
      if (!matches.length) return null;
      return <section key={kind} className={styles.discoverySection} aria-label={heading + " search results"}>
        <div className={styles.discoverySectionHeading}>
          <h2>{heading}</h2>
          {tab === "top" && <button type="button" onClick={() => onSelectTab(targetTab)}>
            See all <span aria-hidden="true">↗</span>
          </button>}
        </div>
        <div className={
          kind === "person" ? styles.discoveryPeople :
          kind === "post" ? styles.discoveryPosts :
          kind === "service" ? styles.discoveryServices : styles.discoveryProducts
        }>
          {matches.map(({ item, index }) =>
            <ResultCard key={item.kind + "-" + item.id} item={item} onOpen={() => onOpen(item, index)} />)}
        </div>
      </section>;
    })}
  </div>;
}
