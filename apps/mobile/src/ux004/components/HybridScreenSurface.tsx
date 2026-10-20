import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { surfaceColors, type SurfaceMode } from "../theme";

type Props = {
  mode: SurfaceMode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Background selection only; SafeAreaProvider remains owned by DemoExperience. */
export function HybridScreenSurface({ mode, children, style }: Props) {
  return <View style={[styles.root, { backgroundColor: surfaceColors[mode] }, style]}>
    {children}
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1 } });
