import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";
import { formatIndianCurrency } from "@stockright/shared/utils";
import {
  DEMO_PARTIES_FILTER_CHIPS,
  DEMO_PARTIES_ROWS,
  filterParties,
} from "@stockright/shared/demo";
import { tokens } from "@stockright/shared/tokens";
import { TabScreenHeader } from "@/components/landing/TabScreenHeader";

const STROKE = 2;

export default function PartiesScreen() {
  const [chip, setChip] = useState(DEMO_PARTIES_FILTER_CHIPS[0]?.id ?? "all");
  const rows = filterParties(DEMO_PARTIES_ROWS, chip);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      stickyHeaderIndices={[0]}
      showsVerticalScrollIndicator={false}
    >
      <TabScreenHeader
        title="Parties"
        searchPlaceholder="Search by name or village…"
        chips={DEMO_PARTIES_FILTER_CHIPS}
        chipActiveId={chip}
        onChipChange={setChip}
      />
      <View style={styles.list}>
        {rows.map((p) => (
          <Pressable
            key={p.name}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.left}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.meta}>
                {p.village} · {p.lots} {p.lots === 1 ? "lot" : "lots"}
              </Text>
            </View>
            <View style={styles.right}>
              {p.balanceType === "due" && p.balanceRupee != null && (
                <>
                  <Text style={styles.amtDue}>{formatIndianCurrency(p.balanceRupee)}</Text>
                  <Text style={styles.amtLabelDue}>DUE</Text>
                </>
              )}
              {p.balanceType === "advance" && p.balanceRupee != null && (
                <>
                  <Text style={styles.amtAdv}>{formatIndianCurrency(p.balanceRupee)}</Text>
                  <Text style={styles.amtLabelAdv}>ADVANCE</Text>
                </>
              )}
              {p.balanceType === "clear" && (
                <View style={styles.clearBadge}>
                  <Check size={12} color={tokens.inward} strokeWidth={STROKE} />
                  <Text style={styles.clearText}>Clear</Text>
                </View>
              )}
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
  left: { flex: 1, minWidth: 0, gap: 4 },
  name: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 17,
    color: tokens.textPrimary,
    lineHeight: 22,
  },
  meta: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
    color: tokens.textSecondary,
    marginTop: 4,
  },
  right: { alignItems: "flex-end", minWidth: 88 },
  amtDue: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 18,
    fontVariant: ["tabular-nums"],
    color: tokens.pending,
  },
  amtLabelDue: {
    fontFamily: "NotoSans-Regular",
    fontSize: 10,
    letterSpacing: 0.06,
    color: tokens.pending,
    marginTop: 2,
  },
  amtAdv: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 18,
    fontVariant: ["tabular-nums"],
    color: tokens.inward,
  },
  amtLabelAdv: {
    fontFamily: "NotoSans-Regular",
    fontSize: 10,
    letterSpacing: 0.06,
    color: tokens.inward,
    marginTop: 2,
  },
  clearBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.inwardBg,
    borderWidth: 1,
    borderColor: tokens.inwardBorder,
  },
  clearText: {
    fontFamily: "NotoSans-Medium",
    fontSize: 11,
    color: tokens.inward,
  },
});
