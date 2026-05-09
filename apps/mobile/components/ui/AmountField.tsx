import { View, Text, TextInput, StyleSheet } from "react-native";
import {
  formatRupeeDigitsForInput,
  formatRupeeInputLive,
  parseIndianRupeeInput,
} from "@stockright/shared/receipt";
import { tokens } from "@stockright/shared/tokens";

interface AmountFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  optionalSuffix?: string;
  placeholder?: string;
  editable?: boolean;
}

export function AmountField({
  label,
  value,
  onChange,
  optionalSuffix,
  placeholder = "0",
  editable = true,
}: AmountFieldProps) {
  return (
    <View>
      <Text style={styles.label}>
        {label}
        {optionalSuffix ? <Text style={styles.optionalSuffix}> {optionalSuffix}</Text> : null}
      </Text>
      <View style={styles.rupeeRow}>
        <Text style={styles.rupeeSym}>₹</Text>
        <TextInput
          value={value}
          editable={editable}
          onChangeText={(t) => onChange(formatRupeeInputLive(t))}
          onBlur={() => {
            const n = parseIndianRupeeInput(value);
            if (n !== null) onChange(formatRupeeDigitsForInput(n));
          }}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={tokens.textPlaceholder}
          style={styles.rupeeInput}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 6,
    marginTop: 12,
    fontFamily: "NotoSans-Medium",
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.textTertiary,
  },
  optionalSuffix: {
    fontFamily: "NotoSans-Regular",
    textTransform: "none",
    letterSpacing: 0,
    fontSize: 11,
    color: tokens.textPlaceholder,
  },
  rupeeRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.sp3,
    backgroundColor: tokens.bgSubtle,
  },
  rupeeSym: {
    fontFamily: "NotoSansMono-Regular",
    fontSize: 16,
    color: tokens.textSecondary,
    marginRight: 6,
  },
  rupeeInput: {
    flex: 1,
    minHeight: 44,
    fontFamily: "NotoSansMono-Regular",
    fontSize: 16,
    color: tokens.textPrimary,
    paddingVertical: 8,
  },
});
