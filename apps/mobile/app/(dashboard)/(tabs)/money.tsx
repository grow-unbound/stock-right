import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { Receipt, Wallet } from "lucide-react-native";
import { formatIndianCurrency } from "@stockright/shared/utils";
import {
  DEMO_MONEY_FILTER_CHIPS,
  DEMO_MONEY_KPIS,
  DEMO_MONEY_MONTH_PAID_RUPEES,
  DEMO_MONEY_MONTH_RECEIVED_RUPEES,
  DEMO_MONEY_TXNS,
  filterMoneyTxns,
} from "@stockright/shared/demo";
import { tokens } from "@stockright/shared/tokens";
import { TabScreenHeader } from "@/components/landing/TabScreenHeader";

const STROKE = 2;

export default function MoneyScreen() {
  const [chip, setChip] = useState(DEMO_MONEY_FILTER_CHIPS[0]?.id ?? "all");
  const txns = filterMoneyTxns(DEMO_MONEY_TXNS, chip);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      stickyHeaderIndices={[0]}
      showsVerticalScrollIndicator={false}
    >
      <TabScreenHeader
        title="Money"
        searchPlaceholder="Search receipts, payments, parties…"
        chips={DEMO_MONEY_FILTER_CHIPS}
        chipActiveId={chip}
        onChipChange={setChip}
      />

      <View style={styles.body}>
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>THIS MONTH RECEIVED</Text>
            <Text style={[styles.kpiValue, { color: tokens.inward }]}>
              {formatIndianCurrency(DEMO_MONEY_MONTH_RECEIVED_RUPEES)}
            </Text>
            <Text style={styles.kpiSub}>{DEMO_MONEY_KPIS.receivedSub}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>THIS MONTH PAID</Text>
            <Text style={[styles.kpiValue, { color: tokens.outward }]}>
              {formatIndianCurrency(DEMO_MONEY_MONTH_PAID_RUPEES)}
            </Text>
            <Text style={styles.kpiSub}>{DEMO_MONEY_KPIS.paidSub}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Recent transactions</Text>

        {txns.map((t, i) => {
          const isReceipt = t.type === "receipt";
          return (
            <Pressable
              key={`${t.ref}-${i}`}
              style={({ pressed }) => [styles.txn, pressed && styles.txnPressed]}
            >
              <View
                style={[
                  styles.txnIcon,
                  {
                    backgroundColor: isReceipt ? tokens.inwardBg : tokens.outwardBg,
                    borderColor: isReceipt ? tokens.inwardBorder : tokens.outwardBorder,
                  },
                ]}
              >
                {isReceipt ? (
                  <Receipt size={18} color={tokens.inward} strokeWidth={STROKE} />
                ) : (
                  <Wallet size={18} color={tokens.outward} strokeWidth={STROKE} />
                )}
              </View>
              <View style={styles.txnMid}>
                <Text style={styles.txnMeta}>
                  {t.ref} · {t.date} · {t.method}
                </Text>
                <Text style={styles.txnParty} numberOfLines={1}>
                  {t.party}
                </Text>
              </View>
              <View style={styles.txnRight}>
                <Text
                  style={[
                    styles.txnAmt,
                    { color: isReceipt ? tokens.inward : tokens.outward },
                  ]}
                >
                  {isReceipt ? "+" : "−"}
                  {formatIndianCurrency(t.amountRupee)}
                </Text>
                <Text style={styles.txnType}>{isReceipt ? "RECEIPT" : "PAYMENT"}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bgPage },
  content: { paddingBottom: tokens.dashboardScrollBottomInset },
  body: {
    paddingHorizontal: tokens.sp4,
    gap: tokens.sp4,
    paddingTop: tokens.sp4,
  },
  kpiRow: { flexDirection: "row", gap: 10 },
  kpi: {
    flex: 1,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgSurface,
    padding: tokens.sp3,
    gap: 4,
  },
  kpiLabel: {
    fontFamily: "NotoSans-Medium",
    fontSize: 10,
    letterSpacing: 0.06,
    color: tokens.textTertiary,
  },
  kpiValue: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 17,
    fontVariant: ["tabular-nums"],
  },
  kpiSub: {
    fontFamily: "NotoSans-Regular",
    fontSize: 11,
    color: tokens.textSecondary,
  },
  sectionLabel: {
    fontFamily: "NotoSans-Medium",
    fontSize: 11,
    letterSpacing: 0.08,
    color: tokens.textTertiary,
    textTransform: "uppercase",
  },
  txn: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.sp3,
    paddingVertical: tokens.sp3,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgSurface,
  },
  txnPressed: { opacity: 0.96 },
  txnIcon: {
    width: 36,
    height: 36,
    borderRadius: tokens.radiusMd,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  txnMid: { flex: 1, minWidth: 0, gap: 2 },
  txnMeta: {
    fontFamily: "NotoSans-Regular",
    fontSize: 11,
    color: tokens.textTertiary,
    letterSpacing: 0.04,
  },
  txnParty: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 15,
    color: tokens.textPrimary,
  },
  txnRight: { alignItems: "flex-end", flexShrink: 0 },
  txnAmt: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 17,
    fontVariant: ["tabular-nums"],
  },
  txnType: {
    fontFamily: "NotoSans-Regular",
    fontSize: 10,
    letterSpacing: 0.06,
    color: tokens.textTertiary,
    marginTop: 2,
    textTransform: "uppercase",
  },
});
