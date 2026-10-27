/** Hustle Mobile V1 semantic palette, sourced from Figma psxnn95X8nPqEEp7IvEw5s.
 * Consumer mode: immersive dark Feed/Live; warm light utility/screens.
 * Never use accent alone to represent verified trust, payment or success. */
export const colors = {
  paper: "#F7F6F2",
  surface: "#FFFFFF",
  raised: "#E4EFD7",
  darkBase: "#0E1210",
  darkCard: "#27372C",
  ink: "#18281E",
  charcoal: "#27372C",
  textPrimaryLight: "#181A18",
  textSecondaryLight: "#596759",
  textPrimaryDark: "#FFFFFF",
  textSecondaryDark: "#BCD0BF",
  // Figma #778074 is 3.79:1 against cream, so use it for non-text decoration only.
  mutedDecorative: "#778074",
  lime: "#C9F26B",
  line: "#E3E8DF",
  darkLine: "#405046",
  danger: "#BA5555",
  success: "#47704A",
  scrim: "rgba(3,8,5,0.63)",
  overlayDark: "rgba(4,8,6,0.50)",
} as const;

export type SurfaceMode = "darkFeed" | "lightUtility";
export const surfaceColors: Record<SurfaceMode, string> = {
  darkFeed: colors.darkBase,
  lightUtility: colors.paper,
};
