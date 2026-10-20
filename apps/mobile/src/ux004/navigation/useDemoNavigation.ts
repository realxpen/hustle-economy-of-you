import { useCallback, useState } from "react";
import type { RootTab } from "./types";

/** Root-only demo navigation. No routing package, persistence, or network access. */
export function useDemoNavigation() {
  const [activeTab, setActiveTab] = useState<RootTab>("Home");
  const selectTab = useCallback((next: RootTab) => {
    setActiveTab(previous => previous === next ? previous : next);
  }, []);
  return { activeTab, selectTab };
}
