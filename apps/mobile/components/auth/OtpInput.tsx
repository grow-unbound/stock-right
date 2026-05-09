import { useRef } from "react";
import { View, Text, TextInput, StyleSheet, Platform } from "react-native";
import { tokens } from "@stockright/shared/tokens";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

export function OtpInput({ value, onChange, disabled, error }: OtpInputProps) {
  const inputsRef = useRef<(TextInput | null)[]>([]);

  function handleChange(index: number, char: string) {
    const digit = char.replace(/\D/g, "").slice(-1);
    const chars = value.split("");
    chars[index] = digit;
    const next = chars.join("");
    onChange(next);
    if (digit && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(index: number, key: string) {
    if (key === "Backspace" && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
      const chars = value.split("");
      chars[index - 1] = "";
      onChange(chars.join(""));
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {Array.from({ length: 6 }).map((_, i) => (
          <TextInput
            key={i}
            ref={(el) => { inputsRef.current[i] = el; }}
            style={[
              styles.cell,
              error
                ? styles.cellError
                : value[i]
                ? styles.cellFilled
                : styles.cellDefault,
              disabled && styles.cellDisabled,
            ]}
            value={value[i] ?? ""}
            onChangeText={(t) => handleChange(i, t)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
            editable={!disabled}
            keyboardType="numeric"
            maxLength={1}
            textAlign="center"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            selectTextOnFocus
            accessibilityLabel={`Digit ${i + 1}`}
          />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: { flexDirection: "row", gap: 8, justifyContent: "center" },
  cell: {
    width: 48,
    height: 48,
    borderRadius: tokens.radiusMd,
    borderWidth: 1.5,
    fontSize: 22,
    lineHeight: 22,
    paddingVertical: 0,
    fontFamily: "NotoSans-SemiBold",
    color: tokens.textPrimary,
    backgroundColor: tokens.bgSubtle,
    textAlignVertical: "center",
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
  cellDefault: { borderColor: tokens.borderDefault },
  cellFilled: {
    borderColor: tokens.brandUi,
    backgroundColor: tokens.brandSubtle,
  },
  cellError: { borderColor: tokens.outward },
  cellDisabled: { opacity: 0.4 },
  error: {
    textAlign: "center",
    fontSize: 13,
    fontFamily: "NotoSans-Regular",
    color: tokens.outward,
  },
});
