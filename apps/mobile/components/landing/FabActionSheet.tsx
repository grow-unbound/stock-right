import { Modal, Pressable, Text, View, StyleSheet } from "react-native";
import {
  Box,
  ChevronRight,
  Package,
  Truck,
  User,
  Receipt,
  Wallet,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import type { LandingFabAction } from "@stockright/shared/demo";
import { tokens } from "@stockright/shared/tokens";

interface FabActionSheetProps {
  open: boolean;
  title: string;
  actions: LandingFabAction[];
  onClose: () => void;
  onSelect?: (id: string) => void;
}

const STROKE = 2;

function toneBg(tone: LandingFabAction["tone"]) {
  if (tone === "inward") return tokens.inwardBg;
  if (tone === "outward") return tokens.outwardBg;
  return tokens.brandSubtle;
}

function toneColor(tone: LandingFabAction["tone"]) {
  if (tone === "inward") return tokens.inward;
  if (tone === "outward") return tokens.outward;
  return tokens.brandText;
}

function ActionIcon({ id, tone }: { id: string; tone: LandingFabAction["tone"] }) {
  const color = toneColor(tone);
  const size = 22;
  if (id === "add_lot") return <Box size={size} color={color} strokeWidth={STROKE} />;
  if (id === "add_delivery") return <Truck size={size} color={color} strokeWidth={STROKE} />;
  if (id === "add_party") return <User size={size} color={color} strokeWidth={STROKE} />;
  if (id === "add_receipt") return <Receipt size={size} color={color} strokeWidth={STROKE} />;
  if (id === "add_payment") return <Wallet size={size} color={color} strokeWidth={STROKE} />;
  return <Package size={size} color={color} strokeWidth={STROKE} />;
}

export function FabActionSheet({ open, title, actions, onClose, onSelect }: FabActionSheetProps) {
  if (!open) return null;

  async function handleAction(id: string) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect?.(id);
    onClose();
  }

  return (
    <Modal transparent animationType="slide" visible={open} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={20} color={tokens.textPrimary} strokeWidth={STROKE} />
            </Pressable>
          </View>
          {actions.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => void handleAction(a.id)}
              style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: toneBg(a.tone) }]}>
                <ActionIcon id={a.id} tone={a.tone} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionLabel}>{a.label}</Text>
                <Text style={styles.actionHint}>{a.hint}</Text>
              </View>
              <ChevronRight size={18} color={tokens.textTertiary} strokeWidth={STROKE} />
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: tokens.overlayScrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: tokens.bgSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: tokens.sp4,
    paddingTop: tokens.sp3,
    paddingBottom: tokens.sp8,
    gap: 10,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: tokens.bgInset,
    marginBottom: tokens.sp2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.sp2,
  },
  sheetTitle: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 18,
    color: tokens.textPrimary,
  },
  closeBtn: {
    padding: tokens.sp1,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: tokens.bgSubtle,
    borderRadius: tokens.radiusLg,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
  },
  actionRowPressed: {
    opacity: 0.92,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  actionLabel: {
    fontFamily: "NotoSans-SemiBold",
    fontSize: 15,
    color: tokens.textPrimary,
  },
  actionHint: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
    color: tokens.textSecondary,
    lineHeight: 17,
  },
});
