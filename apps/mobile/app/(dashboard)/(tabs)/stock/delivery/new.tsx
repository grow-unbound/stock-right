import { MobileAddDeliveryScreen } from "@/components/stock/MobileAddDeliveryScreen";
import { useRouter } from "expo-router";

export default function StockDeliveryNewRoute() {
  const router = useRouter();
  return (
    <MobileAddDeliveryScreen
      onClose={() => router.back()}
      onDone={() => {}}
    />
  );
}
