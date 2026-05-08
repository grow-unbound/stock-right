import { useState, useEffect, useCallback } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import * as Localization from "expo-localization";
import { ChevronLeft, LogOut, Warehouse, Zap } from "lucide-react-native";
import { fetchUserSessionContext, listWarehouses } from "@stockright/shared/api";
import { translations, defaultLocale, type Locale } from "@stockright/shared/i18n";
import type { UserSessionContext } from "@stockright/shared/types";
import {
  ACTIVE_WAREHOUSE_ID_KEY,
  UI_LOCALE_STORAGE_KEY,
  detectDefaultUiLocaleFromTag,
  languagePickerOptions,
  parseUiLocale,
} from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { getSupabaseClient, resetSupabaseClientSingleton } from "@/lib/supabase";
import { storage } from "@/lib/storage";
import { useIsOffline } from "@/hooks/useIsOffline";

const STROKE = 2;
const DEMO_QUEUE_COUNT = 3;

function fmtCount(template: string, count: number): string {
  return template.replace(/\{\{count\}\}/g, String(count));
}

export default function ProfileScreen() {
  const router = useRouter();
  const offline = useIsOffline();
  const [darkMode, setDarkMode] = useState(false);
  const [context, setContext] = useState<UserSessionContext | null>(null);
  const [canSwitchWarehouse, setCanSwitchWarehouse] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [langModalOpen, setLangModalOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      const stored = await storage.get(UI_LOCALE_STORAGE_KEY);
      const fromDevice = Localization.getLocales()[0]?.languageTag;
      const next =
        parseUiLocale(stored) ?? detectDefaultUiLocaleFromTag(fromDevice) ?? defaultLocale;
      setLocale(next);
    })();
  }, []);

  const load = useCallback(async () => {
    const client = getSupabaseClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }
    const warehouses = await listWarehouses(client, user.id);
    setCanSwitchWarehouse(warehouses.length > 1);
    const active = await storage.get(ACTIVE_WAREHOUSE_ID_KEY);
    const effective =
      active && warehouses.some((w) => w.id === active)
        ? active
        : warehouses.length === 1
          ? warehouses[0]!.id
          : null;
    const ctx = await fetchUserSessionContext(client, effective);
    setContext(ctx);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLogout() {
    const client = getSupabaseClient();
    await client.auth.signOut();
    await storage.remove(ACTIVE_WAREHOUSE_ID_KEY);
    resetSupabaseClientSingleton();
    router.replace("/(auth)/login");
  }

  async function setUiLocale(next: Locale) {
    setLocale(next);
    await storage.set(UI_LOCALE_STORAGE_KEY, next);
  }

  const p = translations[locale].preferences;
  const displayName = context?.fullName?.trim() || context?.phone || "Account";
  const profileSub =
    context?.warehouseName != null
      ? `${context.roleLabel} · ${context.warehouseName}`
      : `${context?.roleLabel ?? "—"}`;

  const currentLangLabel =
    languagePickerOptions.find((o) => o.code === locale)?.labelNative ?? languagePickerOptions[0]!.labelNative;

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={p.back_home}
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={tokens.textPrimary} strokeWidth={STROKE} />
        </Pressable>
        <Text style={styles.topTitle}>{p.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.profileCard}>
            <View style={styles.avatarLargeSkel} />
            <View style={styles.skelTextCol}>
              <View style={styles.skelLineLg} />
              <View style={styles.skelLineSm} />
            </View>
          </View>
        ) : (
          <View style={styles.profileCard}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{context?.initials ?? "?"}</Text>
            </View>
            <View style={styles.profileText}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileSub}>{profileSub}</Text>
            </View>
          </View>
        )}

        <SectionTitle label={p.account} />
        <View style={styles.card}>
          <SettingsValueRow label={p.organization} value={context?.tenantName ?? "—"} />
          <SettingsValueRow label={p.your_role} value={context?.roleLabel ?? "—"} />
          <SettingsValueRow label={p.warehouse} value={context?.warehouseName ?? "—"} last={!canSwitchWarehouse} />
          {canSwitchWarehouse ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={p.switch_warehouse}
              style={({ pressed }) => [styles.switchRow, pressed && styles.switchRowPressed]}
              onPress={() => router.push("/warehouse-select?switch=1")}
            >
              <View style={styles.switchRowLeft}>
                <Warehouse size={18} color={tokens.brandText} strokeWidth={STROKE} />
                <Text style={styles.switchRowLabel}>{p.switch_warehouse}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={p.choose_language}
            style={({ pressed }) => [styles.langRow, styles.langRowBorder, pressed && styles.langRowPressed]}
            onPress={() => setLangModalOpen(true)}
          >
            <Text style={styles.rowLabel}>{p.language}</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue} numberOfLines={1}>
                {currentLangLabel}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
        </View>

        <SectionTitle label={p.display} />
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel}>{p.dark_mode}</Text>
            <Switch value={darkMode} onValueChange={setDarkMode} />
          </View>
        </View>

        <SectionTitle label={p.data} />
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.queueTextCol}>
              <Text style={styles.queueTitle}>{offline ? p.offline_queue : p.synced_title}</Text>
              <Text style={styles.queueSub}>
                {offline ? fmtCount(p.offline_sub, DEMO_QUEUE_COUNT) : p.synced_sub}
              </Text>
            </View>
            {offline ? (
              <View style={styles.queueBadge}>
                <Zap size={12} color={tokens.pending} fill={tokens.pending} />
                <Text style={styles.queueBadgeText}>{fmtCount(p.offline_badge, DEMO_QUEUE_COUNT)}</Text>
              </View>
            ) : (
              <View style={styles.syncedBadge}>
                <Text style={styles.syncedBadgeText}>{p.synced_badge}</Text>
              </View>
            )}
          </View>
        </View>

        <SectionTitle label={p.session} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={p.log_out}
          style={({ pressed }) => [styles.logoutRow, pressed && styles.logoutPressed]}
          onPress={() => void handleLogout()}
        >
          <LogOut size={18} color={tokens.outward} strokeWidth={STROKE} />
          <Text style={styles.logoutLabel}>{p.log_out}</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={langModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setLangModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setLangModalOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{p.choose_language}</Text>
            {languagePickerOptions.map((opt) => {
              const selected = opt.code === locale;
              return (
                <Pressable
                  key={opt.code}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.langOption, pressed && styles.langOptionPressed]}
                  onPress={() => {
                    void setUiLocale(opt.code);
                    setLangModalOpen(false);
                  }}
                >
                  <View>
                    <Text style={styles.langOptionPrimary}>{opt.labelNative}</Text>
                    {opt.labelEn !== opt.labelNative ? (
                      <Text style={styles.langOptionSecondary}>{opt.labelEn}</Text>
                    ) : null}
                  </View>
                  {selected ? <Text style={styles.langCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function SectionTitle({ label }: { label: string }) {
  return <Text style={styles.sectionTitle}>{label.toUpperCase()}</Text>;
}

function SettingsValueRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.settingsValueRow, !last && styles.settingsRowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValuePlain} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bgPage },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.sp2,
    paddingHorizontal: tokens.sp3,
    paddingVertical: tokens.sp3,
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
    backgroundColor: tokens.bgPage,
  },
  backBtn: { padding: tokens.sp1 },
  topTitle: {
    flex: 1,
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 22,
    color: tokens.textPrimary,
  },
  scroll: { padding: tokens.sp4, gap: tokens.sp4, paddingBottom: tokens.sp10 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.sp3,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusXl,
    backgroundColor: tokens.bgSurface,
  },
  avatarLargeSkel: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.bgSubtle,
  },
  skelTextCol: { flex: 1, gap: 8 },
  skelLineLg: { height: 16, width: "70%", borderRadius: 4, backgroundColor: tokens.bgSubtle },
  skelLineSm: { height: 12, width: "50%", borderRadius: 4, backgroundColor: tokens.bgSubtle },
  avatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.brandSubtle,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLargeText: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 18,
    color: tokens.brandText,
  },
  profileText: { flex: 1, gap: 2 },
  profileName: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 17,
    color: tokens.textPrimary,
  },
  profileSub: {
    fontFamily: "NotoSans-Regular",
    fontSize: 13,
    color: tokens.textSecondary,
  },
  sectionTitle: {
    fontFamily: "NotoSans-Medium",
    fontSize: 11,
    letterSpacing: 0.08,
    color: tokens.textTertiary,
  },
  card: {
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusXl,
    backgroundColor: tokens.bgSurface,
    overflow: "hidden",
  },
  settingsValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: tokens.sp4,
    minHeight: 48,
    gap: tokens.sp3,
  },
  settingsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: tokens.sp4,
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
  },
  switchRowPressed: {
    backgroundColor: tokens.bgSubtle,
  },
  switchRowLeft: { flexDirection: "row", alignItems: "center", gap: tokens.sp2 },
  switchRowLabel: {
    fontFamily: "NotoSans-Medium",
    fontSize: 15,
    color: tokens.brandText,
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: tokens.sp4,
    minHeight: 48,
  },
  langRowBorder: {
    borderTopWidth: 1,
    borderTopColor: tokens.borderDefault,
  },
  langRowPressed: {
    backgroundColor: tokens.bgSubtle,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: tokens.sp4,
  },
  rowLabel: {
    fontFamily: "NotoSans-Regular",
    fontSize: 15,
    color: tokens.textPrimary,
  },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "55%" },
  rowValue: {
    fontFamily: "NotoSans-Regular",
    fontSize: 13,
    color: tokens.textTertiary,
    flexShrink: 1,
  },
  rowValuePlain: {
    flex: 1,
    fontFamily: "NotoSans-Regular",
    fontSize: 13,
    color: tokens.textTertiary,
    textAlign: "right",
  },
  chevron: {
    fontSize: 18,
    color: tokens.textTertiary,
    marginTop: -2,
  },
  queueTextCol: { flex: 1, marginRight: tokens.sp3 },
  queueTitle: {
    fontFamily: "NotoSans-Medium",
    fontSize: 14,
    color: tokens.textPrimary,
  },
  queueSub: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
    color: tokens.textSecondary,
    marginTop: 2,
  },
  queueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.pendingBg,
    borderWidth: 1,
    borderColor: tokens.pendingBorder,
  },
  queueBadgeText: {
    fontFamily: "NotoSans-Medium",
    fontSize: 11,
    color: tokens.pending,
  },
  syncedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.inwardBg,
    borderWidth: 1,
    borderColor: tokens.inwardBorder,
  },
  syncedBadgeText: {
    fontFamily: "NotoSans-Medium",
    fontSize: 11,
    color: tokens.inward,
  },
  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.sp2,
    minHeight: tokens.sp12,
    paddingVertical: 14,
    paddingHorizontal: tokens.sp4,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusXl,
    backgroundColor: tokens.bgSurface,
  },
  logoutPressed: {
    backgroundColor: tokens.bgSubtle,
  },
  logoutLabel: {
    fontFamily: "NotoSans-Medium",
    fontSize: 15,
    color: tokens.outward,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: tokens.overlayScrim,
    justifyContent: "center",
    padding: tokens.sp4,
  },
  modalCard: {
    borderRadius: tokens.radiusXl,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
    maxHeight: "70%",
    overflow: "hidden",
  },
  modalTitle: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 17,
    color: tokens.textPrimary,
    paddingHorizontal: tokens.sp4,
    paddingVertical: tokens.sp3,
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: tokens.sp4,
    minHeight: 48,
  },
  langOptionPressed: {
    backgroundColor: tokens.bgSubtle,
  },
  langOptionPrimary: {
    fontFamily: "NotoSans-Medium",
    fontSize: 15,
    color: tokens.textPrimary,
  },
  langOptionSecondary: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
    color: tokens.textTertiary,
    marginTop: 2,
  },
  langCheck: {
    fontFamily: "NotoSans-Medium",
    fontSize: 14,
    color: tokens.inward,
  },
});
