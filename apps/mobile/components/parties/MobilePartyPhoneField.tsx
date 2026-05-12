import { StyleSheet, Text, TextInput, View } from "react-native";
import { tokens } from "@stockright/shared/tokens";

interface MobilePartyPhoneFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MobilePartyPhoneField({
  label,
  value,
  onChange,
  disabled = false,
  placeholder = "98765 43210",
}: MobilePartyPhoneFieldProps) {
  const displayValue = value.startsWith("+91") ? value.slice(3) : value.replace(/\D/g, "");

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.row, disabled && styles.rowDisabled]}>
        <View style={styles.prefix}>
          <Text style={styles.prefixText}>+91</Text>
        </View>
        <TextInput
          style={styles.input}
          value={displayValue}
          onChangeText={(t) => {
            if (disabled) return;
            const d = t.replace(/\D/g, "").slice(0, 10);
            onChange(d ? `+91${d}` : "");
          }}
          placeholder={placeholder}
          placeholderTextColor={tokens.textPlaceholder}
          keyboardType="phone-pad"
          editable={!disabled}
          autoComplete="tel"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: tokens.sp2 },
  label: {
    fontFamily: "NotoSans-Medium",
    fontSize: 13,
    color: tokens.textSecondary,
  },
  row: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgSurface,
    overflow: "hidden",
  },
  rowDisabled: { opacity: 0.6 },
  prefix: {
    paddingHorizontal: 12,
    height: "100%",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
  },
  prefixText: {
    fontSize: 16,
    fontFamily: "NotoSans-Medium",
    color: tokens.textSecondary,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: "NotoSans-Regular",
    color: tokens.textPrimary,
    backgroundColor: tokens.bgSurface,
  },
});
