import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme";
import { TactilePressable } from "./TactilePressable";
type Props = { title: string; detail: string; actionLabel?: string; onAction?: () => void };
/** No fake backend activity: optional action is present only when implemented. */
export function EmptyState({ title, detail, actionLabel, onAction }: Props) {
  return <View style={styles.root}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.detail}>{detail}</Text>
    {actionLabel && onAction ? <TactilePressable
      variant="lime" onPress={onAction} accessibilityLabel={actionLabel} style={styles.action}>
      <Text style={styles.actionText}>{actionLabel}</Text>
    </TactilePressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, gap: spacing.md },
  title: { color: colors.textPrimaryLight, fontSize: typography.title, fontWeight: "800", textAlign: "center" },
  detail: { color: colors.textSecondaryLight, fontSize: typography.body, lineHeight: 24, textAlign: "center" },
  action: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  actionText: { color: colors.ink, fontWeight: "800", fontSize: typography.body },
});
