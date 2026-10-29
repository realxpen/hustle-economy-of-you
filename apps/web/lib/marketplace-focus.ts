import type { MarketplaceTab, SearchFilters } from "./search";

/** Market focus is browsing state, not an account role. */
export function marketplaceView(search: string): MarketplaceTab {
  const value = new URLSearchParams(search).get("view");
  return value === "services" || value === "skills" ? "services"
    : value === "products" ? "products" : "all";
}

/** Type-specific restrictions should never invisibly hide the other market. */
export function marketplaceModeFilters(view: MarketplaceTab, filters: SearchFilters): SearchFilters {
  return {
    ...filters,
    skill: view === "services" ? filters.skill ?? "" : "",
    deliveryMode: view === "services" ? filters.deliveryMode ?? "" : "",
    productType: view === "products" ? filters.productType ?? "" : ""
  };
}

export function marketplaceRoute(view: MarketplaceTab, query: string, category: string): string {
  const params = new URLSearchParams();
  if (view !== "all") params.set("view", view);
  if (query.trim()) params.set("q", query.trim());
  if (category.trim()) params.set("category", category.trim());
  const suffix = params.toString();
  return "/marketplace" + (suffix ? "?" + suffix : "");
}
