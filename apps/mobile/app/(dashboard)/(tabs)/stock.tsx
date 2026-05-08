import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { Check, Hourglass } from "lucide-react-native";
import {
  DEMO_STOCK_FILTER_CHIPS,
  DEMO_STOCK_LOTS,
  filterStockLots,
  formatRupeesPlain,
} from "@stockright/shared/demo";
import { tokens } from "@stockright/shared/tokens";
import { TabScreenHeader } from "@/components/landing/TabScreenHeader";

const STROKE = 2;

export default function StockScreen() {
  const [chip, setChip] = useState(DEMO_STOCK_FILTER_CHIPS[0]?.id ?? "all");
  const lots = filterStockLots(DEMO_STOCK_LOTS, chip);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      stickyHeaderIndices={[0]}
      showsVerticalScrollIndicator={false}
    >
      <TabScreenHeader
        title="Stock"
        searchPlaceholder="Search lots, commodities, godowns…"
        chips={DEMO_STOCK_FILTER_CHIPS}
        chipActiveId={chip}
        onChipChange={setChip}
      />
      <View style={styles.list}>
        {lots.map((lot) => (
          <Pressable
            key={lot.lot}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.cardLeft}>
              <Text style={styles.lotId}>{lot.lot}</Text>
              <Text style={styles.commodity}>
                {lot.commodity} · {lot.godown}
              </Text>
              <Text style={styles.party}>{lot.party}</Text>
              <View style={styles.badgeRow}>
                {lot.status === "in_stock" ? (
                  <View style={[styles.badge, styles.badgeIn]}>
                    <Check size={12} color={tokens.inward} strokeWidth={STROKE} />
                    <Text style={styles.badgeInText}>In stock</Text>
                  </View>
                ) : (
                  <View style={[styles.badge, styles.badgeDue]}>
                    <Hourglass size={12} color={tokens.pending} strokeWidth={STROKE} />
                    <Text style={styles.badgeDueText}>Collection due</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.qty}>{formatRupeesPlain(lot.bags)}</Text>
              <Text style={styles.unit}>bags</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bgPage },
  content: { paddingBottom: tokens.dashboardScrollBottomInset },
  list: { paddingHorizontal: tokens.sp4, gap: tokens.sp2, paddingTop: tokens.sp2 },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.sp3,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgSurface,
  },
  cardPressed: { opacity: 0.96 },
  cardLeft: { flex: 1, minWidth: 0, gap: 4 },
  lotId: {
    fontFamily: "NotoSans-Regular",
    fontSize: 11,
    letterSpacing: 0.04,
    color: tokens.textTertiary,
  },
  commodity: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 17,
    color: tokens.textPrimary,
    marginTop: 2,
  },
  party: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
    color: tokens.textSecondary,
    marginTop: 4,
  },
  badgeRow: { marginTop: tokens.sp2 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.radiusPill,
    gap: 4,
  },
  badgeIn: {
    backgroundColor: tokens.inwardBg,
    borderWidth: 1,
    borderColor: tokens.inwardBorder,
  },
  badgeInText: {
    fontFamily: "NotoSans-Medium",
    fontSize: 11,
    color: tokens.inward,
  },
  badgeDue: {
    backgroundColor: tokens.pendingBg,
    borderWidth: 1,
    borderColor: tokens.pendingBorder,
  },
  badgeDueText: {
    fontFamily: "NotoSans-Medium",
    fontSize: 11,
    color: tokens.pending,
  },
  cardRight: { alignItems: "flex-end" },
  qty: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 22,
    fontVariant: ["tabular-nums"],
    color: tokens.textPrimary,
  },
  unit: {
    fontFamily: "NotoSans-Regular",
    fontSize: 10,
    color: tokens.textTertiary,
    marginTop: 2,
  },
});
