import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "../theme";
type Props = { children: React.ReactNode; style?: StyleProp<ViewStyle> };
/** Base utility card; callers may compose their own row/grid layout. */
export function SurfaceCard({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.card, padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
});
