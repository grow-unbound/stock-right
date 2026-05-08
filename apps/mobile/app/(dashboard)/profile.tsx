import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, LogOut, Zap } from "lucide-react-native";
import { DEMO_PROFILE_USER } from "@stockright/shared/demo";
import { tokens } from "@stockright/shared/tokens";

const STROKE = 2;

export default function ProfileScreen() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={tokens.textPrimary} strokeWidth={STROKE} />
        </Pressable>
        <Text style={styles.topTitle}>Preferences</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{DEMO_PROFILE_USER.initials}</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.profileName}>{DEMO_PROFILE_USER.name}</Text>
            <Text style={styles.profileSub}>{DEMO_PROFILE_USER.subtitle}</Text>
          </View>
        </View>

        <SectionTitle label="Account" />
        <View style={styles.card}>
          <SettingsRow label="Language" value={DEMO_PROFILE_USER.languageDisplay} />
          <SettingsRow label="Godown" value={DEMO_PROFILE_USER.godownDisplay} />
          <SettingsRow label="Number format" value={DEMO_PROFILE_USER.numberFormatSample} last />
        </View>

        <SectionTitle label="Display" />
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel}>Dark mode</Text>
            <Switch value={darkMode} onValueChange={setDarkMode} />
          </View>
        </View>

        <SectionTitle label="Data" />
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.queueTitle}>Offline queue</Text>
              <Text style={styles.queueSub}>3 entries waiting to upload</Text>
            </View>
            <View style={styles.queueBadge}>
              <Zap size={12} color={tokens.pending} fill={tokens.pending} />
              <Text style={styles.queueBadgeText}>3 queued</Text>
            </View>
          </View>
        </View>

        <SectionTitle label="Session" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log out"
          style={({ pressed }) => [styles.logoutRow, pressed && styles.logoutPressed]}
          onPress={() => {}}
        >
          <LogOut size={18} color={tokens.outward} strokeWidth={STROKE} />
          <Text style={styles.logoutLabel}>Log out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <Text style={styles.sectionTitle}>{label.toUpperCase()}</Text>
  );
}

function SettingsRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <Pressable style={[styles.settingsRow, !last && styles.settingsRowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue}>{value}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
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
    marginTop: tokens.sp1,
  },
  card: {
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusXl,
    backgroundColor: tokens.bgSurface,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: tokens.sp4,
  },
  settingsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
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
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowValue: {
    fontFamily: "NotoSans-Regular",
    fontSize: 13,
    color: tokens.textTertiary,
  },
  chevron: {
    fontSize: 18,
    color: tokens.textTertiary,
    marginTop: -2,
  },
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
});
