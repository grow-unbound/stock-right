import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { formatIndianCurrency } from "@stockright/shared/utils";
import {
  DEMO_HOME_COLLECTION_DUE_RUPEES,
  DEMO_HOME_FILTER_CHIPS,
  DEMO_HOME_KPIS,
  DEMO_HOME_RECENT_ENTRIES,
  DEMO_HOME_REGISTER_DATE,
  DEMO_PROFILE_USER,
  filterHomeRecent,
  formatRupeesPlain,
} from "@stockright/shared/demo";
import { tokens } from "@stockright/shared/tokens";
import { TabScreenHeader } from "@/components/landing/TabScreenHeader";

const STROKE = 2;

export default function HomeScreen() {
  const router = useRouter();
  const [chip, setChip] = useState(DEMO_HOME_FILTER_CHIPS[0]?.id ?? "today");
  const recent = filterHomeRecent(DEMO_HOME_RECENT_ENTRIES, chip).slice(0, 5);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      stickyHeaderIndices={[0]}
      showsVerticalScrollIndicator={false}
    >
      <TabScreenHeader
        title="Home"
        searchPlaceholder="Search lots, parties, commodities…"
        chips={DEMO_HOME_FILTER_CHIPS}
        chipActiveId={chip}
        onChipChange={setChip}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Preferences"
            onPress={() => router.push("/profile")}
            style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}
          >
            <Text style={styles.avatarText}>{DEMO_PROFILE_USER.initials}</Text>
          </Pressable>
        }
      />

      <View style={styles.body}>
        <View style={styles.registerIntro}>
          <Text style={styles.dateLine}>{DEMO_HOME_REGISTER_DATE}</Text>
          <Text style={styles.registerTitle}>{"Today's register"}</Text>
        </View>

        <View style={styles.kpiGrid}>
          <KpiCard
            label="Today inward"
            value={String(DEMO_HOME_KPIS.todayInwardBags)}
            sub={DEMO_HOME_KPIS.todayInwardSub}
            accent={tokens.inward}
          />
          <KpiCard
            label="Today outward"
            value={String(DEMO_HOME_KPIS.todayOutwardBags)}
            sub={DEMO_HOME_KPIS.todayOutwardSub}
            accent={tokens.outward}
          />
          <KpiCard
            label="Stock on hand"
            value={formatRupeesPlain(DEMO_HOME_KPIS.stockOnHandBags)}
            sub={DEMO_HOME_KPIS.stockOnHandSub}
            accent={tokens.textPrimary}
          />
          <KpiCard
            label="Collection due"
            value={formatIndianCurrency(DEMO_HOME_COLLECTION_DUE_RUPEES)}
            sub={DEMO_HOME_KPIS.collectionDueSub}
            accent={tokens.pending}
          />
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>Recent entries</Text>
          <Pressable accessibilityRole="button">
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>

        {recent.map((e, i) => (
          <Pressable
            key={`${e.lot}-${e.time}-${i}`}
            style={({ pressed }) => [styles.entryCard, pressed && styles.entryPressed]}
          >
            <View
              style={[
                styles.entryIcon,
                { backgroundColor: e.type === "inward" ? tokens.inwardBg : tokens.outwardBg },
              ]}
            >
              {e.type === "inward" ? (
                <ArrowLeft size={18} color={tokens.inward} strokeWidth={STROKE} />
              ) : (
                <ArrowRight size={18} color={tokens.outward} strokeWidth={STROKE} />
              )}
            </View>
            <View style={styles.entryMid}>
              <Text style={styles.entryMeta}>
                {e.lot} · {e.time}
              </Text>
              <Text style={styles.entryParty}>{e.party}</Text>
              <Text style={styles.entryLine}>
                {e.godown} · {e.commodity}
              </Text>
            </View>
            <Text
              style={[
                styles.entryQty,
                { color: e.type === "inward" ? tokens.inward : tokens.outward },
              ]}
            >
              {e.type === "inward" ? "+" : "−"}
              {e.bags} bags
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.kpiValue, { color: accent }]}>{value}</Text>
      <Text style={styles.kpiSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bgPage },
  content: { paddingBottom: tokens.dashboardScrollBottomInset },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.brandSubtle,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPressed: { opacity: 0.88 },
  avatarText: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 14,
    color: tokens.brandText,
  },
  body: {
    paddingHorizontal: tokens.sp4,
    gap: tokens.sp4,
    paddingTop: tokens.sp4,
  },
  registerIntro: { gap: 2 },
  dateLine: {
    fontFamily: "NotoSans-Regular",
    fontSize: 13,
    color: tokens.textSecondary,
  },
  registerTitle: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 22,
    color: tokens.textPrimary,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCard: {
    width: "48%",
    flexGrow: 1,
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
    fontSize: 22,
    fontVariant: ["tabular-nums"],
  },
  kpiSub: {
    fontFamily: "NotoSans-Regular",
    fontSize: 11,
    color: tokens.textSecondary,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: tokens.sp1,
  },
  sectionLabel: {
    fontFamily: "NotoSans-Medium",
    fontSize: 11,
    letterSpacing: 0.08,
    color: tokens.textTertiary,
    textTransform: "uppercase",
  },
  seeAll: {
    fontFamily: "NotoSans-Medium",
    fontSize: 12,
    color: tokens.brandText,
  },
  entryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.sp3,
    paddingVertical: tokens.sp3,
    paddingHorizontal: tokens.sp3,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgSurface,
  },
  entryPressed: { opacity: 0.95 },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radiusMd,
    alignItems: "center",
    justifyContent: "center",
  },
  entryMid: { flex: 1, minWidth: 0, gap: 2 },
  entryMeta: {
    fontFamily: "NotoSans-Regular",
    fontSize: 11,
    color: tokens.textTertiary,
  },
  entryParty: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 15,
    color: tokens.textPrimary,
  },
  entryLine: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
    color: tokens.textSecondary,
  },
  entryQty: {
    fontFamily: "NotoSans-SemiBold",
    fontSize: 14,
    flexShrink: 0,
  },
});
