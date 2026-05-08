import { Text, View, StyleSheet } from "react-native";
import { Zap } from "lucide-react-native";
import { tokens } from "@stockright/shared/tokens";

interface OfflineBannerProps {
  queueCount: number;
}

export function OfflineBanner({ queueCount }: OfflineBannerProps) {
  const entryWord = queueCount === 1 ? "entry" : "entries";
  return (
    <View style={styles.wrap}>
      <Zap size={14} color={tokens.pending} fill={tokens.pending} />
      <Text style={styles.text}>
        Offline · {queueCount} {entryWord} queued — will upload when connected
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.sp2,
    paddingVertical: tokens.sp2,
    paddingHorizontal: tokens.sp4,
    backgroundColor: tokens.pendingBg,
    borderBottomWidth: 1,
    borderBottomColor: tokens.pendingBorder,
  },
  text: {
    flex: 1,
    fontFamily: "NotoSans-Medium",
    fontSize: 12,
    color: tokens.pending,
  },
});
