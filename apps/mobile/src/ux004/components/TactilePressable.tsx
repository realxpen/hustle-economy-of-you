import React from "react";
import {
  Pressable, StyleSheet,
  type PressableProps, type StyleProp, type ViewStyle,
} from "react-native";
import { colors, layout, radii } from "../theme";

type Variant = "lime" | "light" | "dark" | "ghost";
type Props = Omit<PressableProps, "style" | "children"> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: Variant;
};

/** Dependency-free, accessible feedback. Does not perform navigation or data writes. */
export function TactilePressable({
  children, style, variant = "ghost", disabled, accessibilityRole = "button", ...rest
}: Props) {
  return <Pressable
    {...rest}
    disabled={disabled}
    accessibilityRole={accessibilityRole}
    accessibilityState={{ ...rest.accessibilityState, disabled: !!disabled }}
    style={({ pressed }) => [
      styles.base,
      variant === "lime" && styles.lime,
      variant === "light" && styles.light,
      variant === "dark" && styles.dark,
      pressed && !disabled && styles.pressed,
      disabled && styles.disabled,
      style,
    ]}
  >{children}</Pressable>;
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTapTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.button,
  },
  lime: { backgroundColor: colors.lime },
  light: { backgroundColor: colors.surface },
  dark: { backgroundColor: colors.ink },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
});
