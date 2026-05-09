import { useRouter } from "expo-router";
import { MobileAddLotScreen } from "@/components/stock/MobileAddLotScreen";

export default function StockLotNewRoute() {
  const router = useRouter();

  return (
    <MobileAddLotScreen
      onClose={() => router.back()}
      onDone={() => router.back()}
    />
  );
}
