import { Pressable, ScrollView, Text, StyleSheet } from "react-native";
import type { LandingFilterChip } from "@stockright/shared/demo";
import { tokens } from "@stockright/shared/tokens";

interface FilterChipRowProps {
  chips: LandingFilterChip[];
  activeId: string;
  onChange: (id: string) => void;
}

export function FilterChipRow({ chips, activeId, onChange }: FilterChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.scroll}
    >
      {chips.map((c) => {
        const selected = c.id === activeId;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(c.id)}
            style={({ pressed }) => [
              styles.chip,
              selected ? styles.chipSelected : styles.chipDefault,
              pressed && !selected && styles.chipPressed,
            ]}
          >
            <Text style={[styles.label, selected ? styles.labelSelected : styles.labelDefault]}>{c.label}</Text>
            {c.count != null && (
              <Text style={[styles.count, selected ? styles.countSelected : styles.countDefault]}>{c.count}</Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    paddingBottom: tokens.sp3,
  },
  scrollContent: {
    flexDirection: "row",
    gap: tokens.sp2,
    paddingHorizontal: tokens.sp4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 30,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
  },
  chipDefault: {
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
  },
  chipSelected: {
    borderColor: tokens.brandUi,
    backgroundColor: tokens.brandSubtle,
  },
  chipPressed: {
    backgroundColor: tokens.bgSubtle,
  },
  label: {
    fontFamily: "NotoSans-Medium",
    fontSize: 13,
  },
  labelSelected: {
    fontFamily: "NotoSans-SemiBold",
    color: tokens.brandText,
  },
  labelDefault: {
    color: tokens.textSecondary,
  },
  count: {
    fontFamily: "NotoSans-Regular",
    fontSize: 10,
    opacity: 0.7,
  },
  countSelected: {
    color: tokens.brandText,
  },
  countDefault: {
    color: tokens.textSecondary,
  },
});
