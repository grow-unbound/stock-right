import type { ReactNode } from "react";
import { Pressable, Text, TextInput, View, StyleSheet } from "react-native";
import { Search } from "lucide-react-native";
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
}: TabScreenHeaderProps) {
  const controlledSearch = searchValue !== undefined && onSearchChange !== undefined;

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
              value={searchValue}
              onChangeText={onSearchChange}
              placeholder={searchPlaceholder}
              placeholderTextColor={tokens.textPlaceholder}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={searchPlaceholder}
            />
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
  searchPlaceholder: {
    flex: 1,
    fontFamily: "NotoSans-Regular",
    fontSize: tokens.fsInput,
    color: tokens.textPlaceholder,
  },
  searchInput: {
    flex: 1,
    fontFamily: "NotoSans-Regular",
    fontSize: tokens.fsInput,
    color: tokens.textPrimary,
    paddingVertical: 0,
  },
});
