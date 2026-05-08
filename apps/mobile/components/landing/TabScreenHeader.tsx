import type { ReactNode } from "react";
import { Pressable, Text, TextInput, View, StyleSheet } from "react-native";
import { Search, X } from "lucide-react-native";
import type { LandingFilterChip } from "@stockright/shared/demo";
import { tokens } from "@stockright/shared/tokens";
import { FilterChipRow } from "./FilterChipRow";

interface TabScreenHeaderProps {
  title: string;
  searchPlaceholder: string;
  chips: LandingFilterChip[];
  chipActiveId: string;
  onChipChange: (id: string) => void;
  trailing?: ReactNode;
  searchValue?: string;
  onSearchChange?: (text: string) => void;
  /** Shown after the search field (e.g. in-flight search indicator). */
  searchAccessory?: ReactNode;
}

export function TabScreenHeader({
  title,
  searchPlaceholder,
  chips,
  chipActiveId,
  onChipChange,
  trailing,
  searchValue,
  onSearchChange,
  searchAccessory,
}: TabScreenHeaderProps) {
  const controlledSearch = typeof onSearchChange === "function";

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {trailing}
      </View>
      <View style={styles.searchOuter}>
        {controlledSearch ? (
          <View style={styles.searchInner}>
            <Search size={18} color={tokens.textTertiary} strokeWidth={2} />
            <TextInput
              value={searchValue ?? ""}
              onChangeText={onSearchChange}
              placeholder={searchPlaceholder}
              placeholderTextColor={tokens.textPlaceholder}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={searchPlaceholder}
            />
            {(searchValue ?? "").trim() !== "" ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={12}
                onPress={() => onSearchChange?.("")}
                style={({ pressed }) => [styles.clearSearch, pressed && styles.clearSearchPressed]}
              >
                <X size={18} color={tokens.textTertiary} strokeWidth={2} />
              </Pressable>
            ) : null}
            {searchAccessory}
          </View>
        ) : (
          <Pressable style={styles.searchInner} accessibilityRole="button">
            <Search size={18} color={tokens.textTertiary} strokeWidth={2} />
            <Text style={styles.searchPlaceholder}>{searchPlaceholder}</Text>
          </Pressable>
        )}
      </View>
      <FilterChipRow chips={chips} activeId={chipActiveId} onChange={onChipChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: tokens.bgPage,
    paddingTop: tokens.sp2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: tokens.sp4,
    paddingBottom: tokens.sp2,
  },
  title: {
    flex: 1,
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 22,
    color: tokens.textPrimary,
    lineHeight: 28,
  },
  searchOuter: {
    paddingHorizontal: tokens.sp4,
    paddingBottom: 10,
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.sp2,
    minHeight: 48,
    paddingHorizontal: tokens.sp3,
    backgroundColor: tokens.bgSurface,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 0,
    fontFamily: "NotoSans-Regular",
    fontSize: tokens.fsInput,
    color: tokens.textPrimary,
  },
  searchPlaceholder: {
    flex: 1,
    fontFamily: "NotoSans-Regular",
    fontSize: tokens.fsInput,
    color: tokens.textPlaceholder,
  },
  clearSearch: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -4,
  },
  clearSearchPressed: { opacity: 0.85 },
});
