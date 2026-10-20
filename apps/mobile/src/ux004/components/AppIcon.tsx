import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

export type AppIconName = React.ComponentProps<typeof Ionicons>["name"];
type Props = {
  name: AppIconName;
  size?: number;
  color?: string;
  selected?: boolean;
};

/** Presentation only; surrounding Pressable owns its accessible label/action. */
export function AppIcon({ name, size = 24, color, selected = false }: Props) {
  return <Ionicons
    name={name}
    size={size}
    color={color ?? (selected ? colors.ink : colors.textPrimaryDark)}
  />;
}
