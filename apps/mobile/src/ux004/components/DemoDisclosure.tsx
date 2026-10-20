import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii, spacing, typography } from "../theme";

type Props = {
  label: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Never removes the visible disclosure that content is fictitious and offline. */
export function DemoDisclosure({ label, compact = false, style }: Props) {
  return <View accessible accessibilityLabel={label}
    style={[styles.base, compact ? styles.compact : styles.full, style]}>
    <Text style={styles.label}>{label}</Text>
  </View>;
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    backgroundColor: colors.charcoal,
    borderColor: colors.lime,
    borderWidth: 1,
    borderRadius: radii.pill,
  },
  compact: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  full: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  label: {
    color: colors.lime,
    fontSize: typography.label,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
