import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, layout, radii, spacing, typography } from "../theme";

/** One consistent selected/idle state for skill and filter chips. */
export function SkillChip({ label, accessibilityLabel, active = false, onPress, role = "button" }: {
  label: string; accessibilityLabel?: string; active?: boolean; onPress: () => void; role?: "tab" | "button";
}) {
  return <Pressable accessibilityRole={role} accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ selected: active }} onPress={onPress}
    style={({ pressed }) => [styles.base, active && styles.active, pressed && styles.pressed]}>
    <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTapTarget, borderRadius: radii.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.md, justifyContent: "center", alignItems: "center",
    alignSelf: "flex-start",
  },
  active: { backgroundColor: colors.ink, borderColor: colors.ink },
  text: { color: colors.textPrimaryLight, fontSize: typography.caption, fontWeight: "800" },
  textActive: { color: colors.textPrimaryDark },
  pressed: { opacity: 0.78 },
});
