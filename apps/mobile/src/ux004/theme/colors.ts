/** UX004-ADR-001: approved Hybrid theme. No global dark-mode switch. */
export const colors = {
  ink: "#151D19",
  charcoal: "#26332A",
  paper: "#F7F6F2",
  surface: "#FFFFFF",
  lime: "#C9F26B",
  textPrimaryLight: "#151D19",
  textSecondaryLight: "#536159",
  textPrimaryDark: "#FFFFFF",
  textSecondaryDark: "#A7C2AC",
  mutedDecorative: "#758178",
  line: "#D9E2D8",
  scrim: "rgba(3,8,5,0.63)",
  overlayDark: "rgba(4,8,6,0.50)",
} as const;

export type SurfaceMode = "darkFeed" | "lightUtility";
export const surfaceColors: Record<SurfaceMode, string> = {
  darkFeed: colors.ink,
  lightUtility: colors.paper,
};
