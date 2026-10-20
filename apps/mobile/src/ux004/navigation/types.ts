/** Root destinations are distinct from the Create action in the center of the bar. */
export const ROOT_TABS = ["Home", "Explore", "Inbox", "You"] as const;
export type RootTab = (typeof ROOT_TABS)[number];
export type NavigationItem = RootTab | "Create";
