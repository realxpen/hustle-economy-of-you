import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { AppIcon } from "./AppIcon";
import { colors, layout, radii, spacing, typography } from "../theme";

/** Shared Figma Mobile V1 sheet chrome: headings, grabber, accessible close. */
export function SheetChrome({ title, onClose, caption, closeStyle }: {
  title: string; onClose: () => void; caption?: string;
  closeStyle?: StyleProp<ViewStyle>;
}) {
  return <View style={styles.wrapper}>
    <View style={styles.grabber} accessible={false}/>
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
      <Pressable
        accessibilityRole="button" accessibilityLabel={"Close " + title}
        accessibilityHint="Returns to the previous screen"
        onPress={onClose} hitSlop={4}
        style={({ pressed }) => [styles.close, closeStyle, pressed && styles.pressed]}>
        <AppIcon name="close" size={22} color={colors.ink}/>
      </Pressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  grabber: {
    width: 44, height: 5, borderRadius: radii.pill,
    backgroundColor: colors.line, alignSelf: "center", marginBottom: spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  text: { flex: 1, minWidth: 0 },
  title: { color: colors.textPrimaryLight, fontSize: typography.title, fontWeight: "900", letterSpacing: -0.4 },
  caption: { color: colors.textSecondaryLight, fontSize: typography.label, marginTop: 4 },
  close: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, borderRadius: radii.pill,
    backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.76 },
});
