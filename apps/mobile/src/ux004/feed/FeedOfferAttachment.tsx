import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, layout } from "../theme";
import { getDemoOfferCopy, type DemoOfferKind } from "./demoOfferCopy";

type Props = {
  kind: DemoOfferKind;
  title: string;
  price: string;
  creatorName: string;
  onPress: () => void;
};

/**
 * A post-to-offer preview, never a Book/Buy action.
 * The source of truth remains the fictional post fixture; no API call.
 */
export function FeedOfferAttachment({ kind, title, price, creatorName, onPress }: Props) {
  const copy = getDemoOfferCopy(kind);
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={copy.action + ": " + title + " by " + creatorName + ", " + price + ". Sample only"}
    accessibilityHint={copy.noTransaction}
    onPress={onPress}
    style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.copy}>
      <Text style={styles.badge}>{copy.badge}</Text>
      <Text style={styles.title} numberOfLines={2}>{title}</Text>
      <Text style={styles.price}>{price}</Text>
    </View>
    <View style={styles.action} accessible={false}>
      <Text style={styles.actionText}>View ↗</Text>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: {
    minHeight: layout.minTapTarget,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#64816D",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#293C30",
    gap: 8,
  },
  pressed: { opacity: 0.85 },
  copy: { flex: 1, minWidth: 0 },
  badge: { color: "#DCEBCF", fontSize: 12, lineHeight: 16, fontWeight: "800", letterSpacing: 0.5 },
  title: { color: colors.surface, fontSize: 14, lineHeight: 19, fontWeight: "800", marginTop: 3 },
  price: { color: colors.lime, fontSize: 13, lineHeight: 18, fontWeight: "800", marginTop: 3 },
  action: {
    minHeight: layout.minTapTarget,
    minWidth: 55,
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: { color: colors.lime, fontWeight: "800", fontSize: 12 },
});
