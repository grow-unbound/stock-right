import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LayoutDashboard, Package, Users, Banknote, UserCog } from "lucide-react-native";
import { tokens } from "@stockright/shared/tokens";

const TABBAR_HEIGHT = 64;
const ICON_SIZE = 20;
const STROKE_WIDTH = 2;

const ROUTE_ICONS = {
  index: LayoutDashboard,
  stock: Package,
  parties: Users,
  money: Banknote,
  users: UserCog,
} as const;

type RouteName = keyof typeof ROUTE_ICONS;

function isRouteName(name: string): name is RouteName {
  return name in ROUTE_ICONS;
}

type TabRoute = BottomTabBarProps["state"]["routes"][number];

export function DashboardTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const barHeight = TABBAR_HEIGHT + bottomPad;

  return (
    <View
      style={[
        styles.bar,
        {
          height: barHeight,
          paddingBottom: bottomPad,
        },
      ]}
    >
      {state.routes.map((route) => (
        <TabSlot
          key={route.key}
          route={route}
          state={state}
          descriptors={descriptors}
          navigation={navigation}
        />
      ))}
    </View>
  );
}

function TabSlot({
  route,
  state,
  descriptors,
  navigation,
}: {
  route: TabRoute;
} & Pick<BottomTabBarProps, "state" | "descriptors" | "navigation">) {
  const { options } = descriptors[route.key];
  const rawLabel = options.tabBarLabel;
  const label =
    typeof rawLabel === "string"
      ? rawLabel
      : options.title !== undefined
        ? String(options.title)
        : route.name;

  const isFocused = state.routes[state.index]?.key === route.key;
  const bgColor = isFocused ? tokens.brandSubtle : "transparent";
  const color = isFocused ? tokens.brandText : tokens.textTertiary;

  const IconComponent = isRouteName(route.name) ? ROUTE_ICONS[route.name] : LayoutDashboard;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
      onPress={async () => {
        await Haptics.selectionAsync();
        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });
        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name, route.params);
        }
      }}
      style={[styles.tab, { backgroundColor: bgColor }]}
    >
      <IconComponent size={ICON_SIZE} color={color} strokeWidth={STROKE_WIDTH} />
      <Text
        style={[
          styles.tabLabel,
          isFocused ? styles.tabLabelActive : styles.tabLabelInactive,
          { color },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
    paddingTop: 6,
    gap: 4,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    minWidth: 48,
    alignItems: "center",
    gap: 3,
    paddingVertical: 6,
    borderRadius: 10,
  },
  tabLabel: {
    fontSize: 11,
    maxWidth: 72,
    textAlign: "center",
  },
  tabLabelActive: {
    fontFamily: "NotoSans-SemiBold",
  },
  tabLabelInactive: {
    fontFamily: "NotoSans-Medium",
  },
});
