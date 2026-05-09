import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "@stockright/shared/tokens";

interface BrandedAlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  /** Primary / acknowledgement label. */
  confirmLabel?: string;
  onConfirm: () => void;
  /** Two-button layout when both set. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Style primary as destructive. */
  primaryDestructive?: boolean;
}

export function BrandedAlertModal({
  visible,
  title,
  message,
  confirmLabel = "OK",
  onConfirm,
  secondaryLabel,
  onSecondary,
  primaryDestructive,
}: BrandedAlertModalProps) {
  const twoButton = secondaryLabel !== undefined && onSecondary !== undefined;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={twoButton ? onSecondary : onConfirm}>
      <Pressable style={styles.scrim} onPress={twoButton ? onSecondary : onConfirm}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={[styles.actions, !twoButton && styles.actionsSingle]}>
            {twoButton ?
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={onSecondary}
                  style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.pressed]}
                >
                  <Text style={styles.btnSecondaryText}>{secondaryLabel}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={onConfirm}
                  style={({ pressed }) => [
                    styles.btn,
                    primaryDestructive ? styles.btnDanger : styles.btnPrimary,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={primaryDestructive ? styles.btnDangerText : styles.btnPrimaryText}>{confirmLabel}</Text>
                </Pressable>
              </>
            : <Pressable
                accessibilityRole="button"
                onPress={onConfirm}
                style={({ pressed }) => [styles.btn, styles.btnPrimary, styles.btnFull, pressed && styles.pressed]}
              >
                <Text style={styles.btnPrimaryText}>{confirmLabel}</Text>
              </Pressable>}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: tokens.overlayScrim,
    justifyContent: "center",
    paddingHorizontal: tokens.sp4,
  },
  card: {
    borderRadius: tokens.radiusLg,
    backgroundColor: tokens.bgSurface,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    paddingHorizontal: tokens.sp5,
    paddingTop: tokens.sp5,
    paddingBottom: tokens.sp4,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  title: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 18,
    color: tokens.textPrimary,
  },
  message: {
    marginTop: tokens.sp2,
    fontFamily: "NotoSans-Regular",
    fontSize: 15,
    lineHeight: 22,
    color: tokens.textSecondary,
  },
  actions: {
    flexDirection: "row",
    gap: tokens.sp2,
    marginTop: tokens.sp5,
  },
  actionsSingle: {
    flexDirection: "column",
  },
  btn: {
    minHeight: 48,
    paddingHorizontal: tokens.sp4,
    borderRadius: tokens.radiusMd,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  btnFull: {
    flex: 0,
    width: "100%",
  },
  btnPrimary: {
    backgroundColor: tokens.brandUi,
  },
  btnPrimaryText: {
    fontFamily: "NotoSans-Medium",
    fontSize: 16,
    color: tokens.textOnBrand,
  },
  btnSecondary: {
    backgroundColor: tokens.bgSubtle,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
  },
  btnSecondaryText: {
    fontFamily: "NotoSans-Medium",
    fontSize: 16,
    color: tokens.textPrimary,
  },
  btnDanger: {
    backgroundColor: tokens.outwardBg,
    borderWidth: 1,
    borderColor: tokens.outwardBorder,
  },
  btnDangerText: {
    fontFamily: "NotoSans-Medium",
    fontSize: 16,
    color: tokens.outward,
  },
  pressed: { opacity: 0.92 },
});
