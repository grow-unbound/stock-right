import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "@stockright/shared/tokens";

function parseIsoLocal(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return new Date();
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d);
}

function toIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function formatDisplay(iso: string): string {
  const d = parseIsoLocal(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

interface MobileDatePickerFieldProps {
  value: string;
  onChange: (isoYmd: string) => void;
}

export function MobileDatePickerField({ value, onChange }: MobileDatePickerFieldProps) {
  const parsed = useMemo(() => parseIsoLocal(value), [value]);
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(parsed);
  const [androidShow, setAndroidShow] = useState(false);

  useEffect(() => {
    if (open) setTemp(parsed);
  }, [open, parsed]);

  function applyAndClose(d: Date) {
    onChange(toIsoLocal(d));
    setOpen(false);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Date received"
        style={styles.field}
        onPress={() => {
          if (Platform.OS === "android") {
            setAndroidShow(true);
            return;
          }
          setOpen(true);
        }}
      >
        <Text style={styles.fieldText}>{formatDisplay(value)}</Text>
      </Pressable>

      {Platform.OS === "android" && androidShow ?
        <DateTimePicker
          value={parsed}
          mode="date"
          display="default"
          onChange={(ev, selected) => {
            setAndroidShow(false);
            if (ev.type === "set" && selected) onChange(toIsoLocal(selected));
          }}
        />
      : null}

      {Platform.OS === "ios" ?
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.sheetTitle}>Date received</Text>
              <DateTimePicker
                value={temp}
                mode="date"
                display="spinner"
                themeVariant="light"
                onChange={(_, d) => {
                  if (d) setTemp(d);
                }}
              />
              <View style={styles.sheetActions}>
                <Pressable
                  style={({ pressed }) => [styles.sheetBtn, styles.sheetBtnGhost, pressed && styles.pressed]}
                  onPress={() => setOpen(false)}
                >
                  <Text style={styles.sheetBtnGhostText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.sheetBtn, styles.sheetBtnPrimary, pressed && styles.pressed]}
                  onPress={() => applyAndClose(temp)}
                >
                  <Text style={styles.sheetBtnPrimaryText}>Done</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 48,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSubtle,
    paddingHorizontal: tokens.sp3,
    justifyContent: "center",
  },
  fieldText: {
    fontSize: 16,
    fontFamily: "NotoSans-Regular",
    color: tokens.textPrimary,
  },
  scrim: {
    flex: 1,
    backgroundColor: tokens.overlayScrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: tokens.bgSurface,
    borderTopLeftRadius: tokens.radiusLg,
    borderTopRightRadius: tokens.radiusLg,
    paddingHorizontal: tokens.sp4,
    paddingTop: tokens.sp4,
    paddingBottom: tokens.sp5,
    borderTopWidth: 1,
    borderColor: tokens.borderDefault,
  },
  sheetTitle: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 17,
    color: tokens.textPrimary,
    marginBottom: tokens.sp2,
  },
  sheetActions: {
    flexDirection: "row",
    gap: tokens.sp2,
    marginTop: tokens.sp3,
  },
  sheetBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: tokens.radiusMd,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBtnGhost: {
    backgroundColor: tokens.bgSubtle,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
  },
  sheetBtnGhostText: {
    fontFamily: "NotoSans-Medium",
    fontSize: 16,
    color: tokens.textPrimary,
  },
  sheetBtnPrimary: {
    backgroundColor: tokens.brandUi,
  },
  sheetBtnPrimaryText: {
    fontFamily: "NotoSans-Medium",
    fontSize: 16,
    color: tokens.textOnBrand,
  },
  pressed: { opacity: 0.92 },
});
