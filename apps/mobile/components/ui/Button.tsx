import type { ReactNode } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { tokens } from "@stockright/shared/tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "default" | "lg";

interface ButtonProps {
  onPress?: () => void;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Shown in place of children while loading — no spinner (brand spec §3.5). */
  loadingLabel?: string;
  disabled?: boolean;
  full?: boolean;
}

export function Button({
  onPress,
  children,
  variant = "primary",
  size = "default",
  loading = false,
  loadingLabel,
  disabled = false,
  full = false,
}: ButtonProps) {
  async function handlePress() {
    if (disabled || loading || !onPress) return;
    if (variant === "primary") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        full && styles.full,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`]]}>
        {loading && loadingLabel ? loadingLabel : children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radiusMd,
    minHeight: 48,
    paddingHorizontal: 20,
  },
  full: { width: "100%" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },

  primary: { backgroundColor: tokens.brandUi },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: tokens.brandUi,
  },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: tokens.outward },

  size_sm: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10 },
  size_default: { minHeight: 48 },
  size_lg: { minHeight: 56, paddingHorizontal: 24 },

  text: { fontFamily: "NotoSans-SemiBold" },
  text_primary: { color: tokens.textOnBrand },
  text_secondary: { color: tokens.brandText },
  text_ghost: { color: tokens.brandText },
  text_danger: { color: tokens.textOnBrand },

  textSize_sm: { fontSize: 13 },
  textSize_default: { fontSize: 15 },
  textSize_lg: { fontSize: 16 },
});
