import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme";
type Props = { title: string; subtitle?: string; eyebrow?: string; trailing?: React.ReactNode };
export function ScreenHeader({ title, subtitle, eyebrow, trailing }: Props) {
  return <View style={styles.header}>
    <View style={styles.main}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
    {trailing}
  </View>;
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  main: { flex: 1 },
  eyebrow: { color: colors.textSecondaryLight, fontSize: typography.label, fontWeight: "800", letterSpacing: 1.3, marginBottom: spacing.xxs },
  title: { color: colors.textPrimaryLight, fontSize: typography.display, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: colors.textSecondaryLight, fontSize: typography.body, marginTop: spacing.xxs },
});
