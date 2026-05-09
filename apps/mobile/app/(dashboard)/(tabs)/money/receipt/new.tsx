import { useRouter } from "expo-router";
import { MobileAddReceiptScreen } from "@/components/money/MobileAddReceiptScreen";

export default function MoneyReceiptNewRoute() {
  const router = useRouter();

  return (
    <MobileAddReceiptScreen
      onClose={() => router.back()}
      onDone={() => router.back()}
    />
  );
}
