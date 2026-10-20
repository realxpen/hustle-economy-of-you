import React from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { AppIcon, type AppIconName } from "./AppIcon";
import { colors, layout, radii } from "../theme";
import type { RootTab } from "../navigation/types";

type Props = {
  activeTab: RootTab;
  onSelectTab: (tab: RootTab) => void;
  onPressCreate: () => void;
  bottomInset: number;
};

type Destination = { key: RootTab; off: AppIconName; on: AppIconName };
const LEFT: readonly Destination[] = [
  { key: "Home", off: "home-outline", on: "home" },
  { key: "Explore", off: "compass-outline", on: "compass" },
];
const RIGHT: readonly Destination[] = [
  { key: "Inbox", off: "chatbubble-ellipses-outline", on: "chatbubble-ellipses" },
  { key: "You", off: "person-outline", on: "person" },
];

/** Four root tabs and one non-selectable Create action; never performs publishing. */
export function FloatingTabBar({ activeTab, onSelectTab, onPressCreate, bottomInset }: Props) {
  const { width } = useWindowDimensions();
  const inset = width <= layout.compactScreenWidth
    ? layout.navHorizontalInsetCompact
    : layout.navHorizontalInset;
  const bottom = Math.max(bottomInset, layout.navBottomGap);
  const renderTab = ({ key, off, on }: Destination) => {
    const selected = key === activeTab;
    return <Pressable key={key}
      accessibilityRole="tab"
      accessibilityLabel={key}
      accessibilityState={{ selected }}
      onPress={() => onSelectTab(key)}
      style={({ pressed }) => [styles.item, selected && styles.selected, pressed && styles.pressed]}>
      <AppIcon name={selected ? on : off} color={selected ? colors.ink : colors.surface} size={25}/>
    </Pressable>;
  };

  return <View pointerEvents="box-none" style={[styles.outer, { left: inset, right: inset, bottom }]}>
    <View style={styles.capsule}>
      {LEFT.map(renderTab)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create content — unavailable in demo"
        accessibilityHint="Explains that publishing is disabled in the offline preview"
        onPress={onPressCreate}
        style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
        <AppIcon name="add-circle-outline" color={colors.surface} size={27}/>
      </Pressable>
      {RIGHT.map(renderTab)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  outer: { position: "absolute", zIndex: 10 },
  capsule: {
    backgroundColor: colors.ink,
    height: layout.navVisualHeight,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    justifyContent: "space-around",
  },
  item: {
    flex: 1,
    minWidth: layout.minTapTarget,
    minHeight: layout.minTapTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
  },
  selected: { backgroundColor: colors.lime },
  pressed: { opacity: 0.78 },
});
