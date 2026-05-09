import { useRouter } from "expo-router";
import { MobileAddPartyScreen } from "@/components/parties/MobileAddPartyScreen";

export default function PartiesNewRoute() {
  const router = useRouter();

  return (
    <MobileAddPartyScreen
      onClose={() => router.back()}
      onDone={() => router.back()}
    />
  );
}
