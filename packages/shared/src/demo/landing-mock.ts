export interface LandingFilterChip {
  id: string;
  label: string;
  count?: number;
}

export interface DemoHomeRecentEntry {
  type: "inward" | "outward";
  lot: string;
  time: string;
  party: string;
  godown: string;
  commodity: string;
  bags: number;
}

export interface DemoStockLot {
  lot: string;
  commodity: string;
  godown: string;
  bags: number;
  party: string;
  status: "in_stock" | "collection_due";
}

export interface DemoPartyRow {
  name: string;
  village: string;
  lots: number;
  balanceRupee?: number;
  balanceType: "due" | "advance" | "clear";
}

export interface DemoMoneyTxn {
  type: "receipt" | "payment";
  ref: string;
  date: string;
  party: string;
  method: string;
  amountRupee: number;
}

export const DEMO_HOME_FILTER_CHIPS: LandingFilterChip[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

export const DEMO_STOCK_FILTER_CHIPS: LandingFilterChip[] = [
  { id: "all", label: "All lots", count: 47 },
  { id: "in", label: "Inward", count: 38 },
  { id: "out", label: "Outward", count: 9 },
  { id: "due", label: "Due" },
];

export const DEMO_PARTIES_FILTER_CHIPS: LandingFilterChip[] = [
  { id: "all", label: "All", count: 52 },
  { id: "due", label: "Due", count: 7 },
  { id: "advance", label: "Advance", count: 2 },
  { id: "clear", label: "Clear" },
];

export const DEMO_MONEY_FILTER_CHIPS: LandingFilterChip[] = [
  { id: "all", label: "All", count: 84 },
  { id: "receipts", label: "Receipts", count: 62 },
  { id: "payments", label: "Payments", count: 22 },
  { id: "today", label: "Today" },
];

export const DEMO_HOME_REGISTER_DATE = "Tuesday, 12 May 2026";

export const DEMO_HOME_KPIS = {
  todayInwardBags: 240,
  todayInwardSub: "bags · +18 vs yesterday",
  todayOutwardBags: 140,
  todayOutwardSub: "bags · 2 lots out",
  stockOnHandBags: 12_480,
  stockOnHandSub: "bags · 4 godowns",
  collectionDueSub: "across 7 parties",
} as const;

export const DEMO_HOME_COLLECTION_DUE_RUPEES = 247500;

export const DEMO_HOME_RECENT_ENTRIES: DemoHomeRecentEntry[] = [
  {
    type: "inward",
    lot: "AP-1247-23",
    time: "14:32",
    party: "Sri Lakshmi Traders",
    godown: "Cold Storage 3",
    commodity: "Paddy",
    bags: 240,
  },
  {
    type: "outward",
    lot: "AP-1245-23",
    time: "12:08",
    party: "Reddy Rice Mills",
    godown: "Cold Storage 1",
    commodity: "Rice",
    bags: 80,
  },
  {
    type: "inward",
    lot: "AP-1244-23",
    time: "10:14",
    party: "Krishna Agro",
    godown: "Cold Storage 2",
    commodity: "Maize",
    bags: 120,
  },
  {
    type: "outward",
    lot: "AP-1242-23",
    time: "09:02",
    party: "Ganesh Mandi",
    godown: "Cold Storage 3",
    commodity: "Paddy",
    bags: 60,
  },
  {
    type: "inward",
    lot: "AP-1238-23",
    time: "08:15",
    party: "Sri Bhavani Traders",
    godown: "Cold Storage 2",
    commodity: "Rice",
    bags: 95,
  },
];

export const DEMO_STOCK_LOTS: DemoStockLot[] = [
  {
    lot: "AP-1247-23",
    commodity: "Paddy",
    godown: "CS-3",
    bags: 240,
    party: "Sri Lakshmi Traders",
    status: "in_stock",
  },
  {
    lot: "AP-1244-23",
    commodity: "Maize",
    godown: "CS-2",
    bags: 120,
    party: "Krishna Agro",
    status: "in_stock",
  },
  {
    lot: "AP-1240-23",
    commodity: "Rice",
    godown: "CS-1",
    bags: 480,
    party: "Reddy Rice Mills",
    status: "in_stock",
  },
  {
    lot: "AP-1232-23",
    commodity: "Paddy",
    godown: "CS-4",
    bags: 360,
    party: "Mandal Society",
    status: "collection_due",
  },
  {
    lot: "AP-1218-23",
    commodity: "Rice",
    godown: "CS-1",
    bags: 200,
    party: "Sri Bhavani Traders",
    status: "in_stock",
  },
];

export const DEMO_PARTIES_ROWS: DemoPartyRow[] = [
  { name: "Sri Lakshmi Traders", village: "Tenali", lots: 4, balanceType: "due", balanceRupee: 47500 },
  { name: "Reddy Rice Mills", village: "Guntur", lots: 7, balanceType: "due", balanceRupee: 112000 },
  { name: "Krishna Agro Suppliers", village: "Vijayawada", lots: 2, balanceType: "clear" },
  { name: "Mandal Co-op Society", village: "Tenali", lots: 9, balanceType: "due", balanceRupee: 88000 },
  { name: "Sri Bhavani Traders", village: "Repalle", lots: 3, balanceType: "advance", balanceRupee: 24300 },
  { name: "Ganesh Mandi", village: "Bapatla", lots: 1, balanceType: "clear" },
];

export const DEMO_MONEY_MONTH_RECEIVED_RUPEES = 482300;
export const DEMO_MONEY_MONTH_PAID_RUPEES = 84500;
export const DEMO_MONEY_KPIS = {
  receivedSub: "62 receipts",
  paidSub: "22 payments",
} as const;

export const DEMO_MONEY_TXNS: DemoMoneyTxn[] = [
  { type: "receipt", ref: "TXN-2398", date: "12 May", party: "Sri Lakshmi Traders", method: "UPI", amountRupee: 47500 },
  { type: "payment", ref: "TXN-2397", date: "12 May", party: "Krishna Agro", method: "Cash", amountRupee: 18000 },
  { type: "receipt", ref: "TXN-2395", date: "11 May", party: "Reddy Rice Mills", method: "Bank", amountRupee: 112000 },
  { type: "receipt", ref: "TXN-2393", date: "11 May", party: "Mandal Society", method: "UPI", amountRupee: 22000 },
  { type: "payment", ref: "TXN-2392", date: "10 May", party: "Ganesh Mandi", method: "Cash", amountRupee: 8500 },
  { type: "receipt", ref: "TXN-2391", date: "10 May", party: "Sri Bhavani Traders", method: "UPI", amountRupee: 24300 },
];

export type FabActionTone = "inward" | "outward" | "neutral";

export interface LandingFabAction {
  id: string;
  label: string;
  hint: string;
  tone: FabActionTone;
}

export const DEMO_FAB_STOCK_ACTIONS: LandingFabAction[] = [
  {
    id: "add_lot",
    label: "Add Lot",
    hint: "Record a new lot arriving at the godown — paddy, rice, maize.",
    tone: "inward",
  },
  {
    id: "add_delivery",
    label: "Add Delivery",
    hint: "Stock leaving the godown — to a mill, party, or another godown.",
    tone: "outward",
  },
];

export const DEMO_FAB_PARTIES_ACTIONS: LandingFabAction[] = [
  {
    id: "add_party",
    label: "Add Party",
    hint: "New farmer, trader, mill or buyer with name, village & contact.",
    tone: "neutral",
  },
];

export const DEMO_FAB_MONEY_ACTIONS: LandingFabAction[] = [
  {
    id: "add_receipt",
    label: "Add Receipt",
    hint: "Money you received from a party — UPI, cash, or bank transfer.",
    tone: "inward",
  },
  {
    id: "add_payment",
    label: "Add Payment",
    hint: "Money you paid to a party — wages, expenses, or settlements.",
    tone: "outward",
  },
];

export function formatRupeesPlain(ruppees: number): string {
  return ruppees.toLocaleString("en-IN");
}

export function filterStockLots(lots: DemoStockLot[], chipId: string): DemoStockLot[] {
  if (chipId === "all") return lots;
  if (chipId === "due") return lots.filter((l) => l.status === "collection_due");
  if (chipId === "in") return lots.filter((l) => l.status === "in_stock");
  if (chipId === "out") return lots.filter(() => false);
  return lots;
}

export function filterHomeRecent(entries: DemoHomeRecentEntry[], chipId: string): DemoHomeRecentEntry[] {
  if (chipId === "today") return entries.slice(0, 5);
  if (chipId === "week" || chipId === "month" || chipId === "all") return entries;
  return entries;
}

export function filterParties(rows: DemoPartyRow[], chipId: string): DemoPartyRow[] {
  if (chipId === "all") return rows;
  if (chipId === "due") return rows.filter((r) => r.balanceType === "due");
  if (chipId === "advance") return rows.filter((r) => r.balanceType === "advance");
  if (chipId === "clear") return rows.filter((r) => r.balanceType === "clear");
  return rows;
}

export function filterMoneyTxns(txns: DemoMoneyTxn[], chipId: string): DemoMoneyTxn[] {
  if (chipId === "all") return txns;
  if (chipId === "receipts") return txns.filter((t) => t.type === "receipt");
  if (chipId === "payments") return txns.filter((t) => t.type === "payment");
  if (chipId === "today") return txns.filter((t) => t.date === "12 May");
  return txns;
}

export function getLandingFabConfig(
  pathname: string,
  options?: { enableMoneyFab?: boolean }
): {
  title: string;
  actions: LandingFabAction[];
} | null {
  const base = pathname.replace(/\/$/, "") || "/";
  if (base === "/stock") return { title: "Add to stock", actions: DEMO_FAB_STOCK_ACTIONS };
  if (base === "/parties") return { title: "Add party", actions: DEMO_FAB_PARTIES_ACTIONS };
  if (base === "/money") {
    if (options?.enableMoneyFab === false) return null;
    return { title: "Record money", actions: DEMO_FAB_MONEY_ACTIONS };
  }
  return null;
}

export const DEMO_PROFILE_USER = {
  initials: "SK",
  name: "Suresh Kumar",
  subtitle: "Manager · Tenali Cold Storage",
  languageDisplay: "తెలుగు",
  godownDisplay: "Tenali · 4 stores",
  numberFormatSample: "2,47,500",
  offlineQueuedCount: 3,
} as const;

/** Warehouse line from profile subtitle (after role) — nav footers */
export function getDemoProfileWarehouseLine(): string {
  const parts = DEMO_PROFILE_USER.subtitle.split("·").map((s) => s.trim());
  if (parts.length >= 2) return parts.slice(1).join(" · ");
  return "";
}