import { View, Text, TextInput, StyleSheet } from "react-native";
import { tokens } from "@stockright/shared/tokens";

const INPUT_ROW_HEIGHT = 48;

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}

export function PhoneInput({ value, onChange, error, autoFocus }: PhoneInputProps) {
  function handleChange(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 10);
    onChange(digits ? `+91${digits}` : "");
  }

  const displayValue = value.startsWith("+91") ? value.slice(3) : value;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Phone Number</Text>
      <View style={[styles.inputRow, error ? styles.inputRowError : styles.inputRowDefault]}>
        <View style={styles.prefix}>
          <Text style={styles.prefixText}>+91</Text>
        </View>
        <TextInput
          style={styles.input}
          value={displayValue}
          onChangeText={handleChange}
          placeholder="98765 43210"
          placeholderTextColor={tokens.textPlaceholder}
          keyboardType="numeric"
          maxLength={10}
          autoFocus={autoFocus}
          returnKeyType="next"
          textContentType="telephoneNumber"
          multiline={false}
          textAlignVertical="center"
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: {
    fontSize: 13,
    fontFamily: "NotoSans-Medium",
    color: tokens.textSecondary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: tokens.radiusMd,
    borderWidth: 1.5,
    backgroundColor: tokens.bgSurface,
    height: INPUT_ROW_HEIGHT,
    overflow: "hidden",
  },
  inputRowDefault: { borderColor: tokens.borderDefault },
  inputRowError: { borderColor: tokens.outward },
  prefix: {
    paddingHorizontal: 12,
    alignSelf: "stretch",
    borderRightWidth: 1,
    borderRightColor: tokens.borderDefault,
    justifyContent: "center",
  },
  prefixText: {
    fontSize: 16,
    fontFamily: "NotoSans-Medium",
    color: tokens.textSecondary,
  },
  input: {
    flex: 1,
    alignSelf: "stretch",
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontSize: 16, // LOCKED — iOS zoom prevention
    fontFamily: "NotoSans-Regular",
    color: tokens.textPrimary,
  },
  error: {
    fontSize: 12,
    fontFamily: "NotoSans-Regular",
    color: tokens.outward,
  },
});
