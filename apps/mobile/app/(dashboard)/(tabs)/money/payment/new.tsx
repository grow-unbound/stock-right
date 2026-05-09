import { useRouter } from "expo-router";
import { MobileAddPaymentScreen } from "@/components/money/MobileAddPaymentScreen";

export default function MoneyPaymentNewRoute() {
  const router = useRouter();

  return (
    <MobileAddPaymentScreen
      onClose={() => router.back()}
      onDone={() => router.back()}
    />
  );
}
