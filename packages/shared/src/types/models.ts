// App-level domain types derived from the Supabase schema.

export type UserRole = "OWNER" | "MANAGER" | "STAFF";

export interface UserProfile {
  id: string;
  phone: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  isActive: boolean;
  termsAcceptedAt: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  tenantId: string;
  warehouseName: string;
  warehouseCode: string;
  city: string | null;
  state: string | null;
  capacityBags: number | null;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresAt: number;
}

export type NextStep =
  | "create_warehouse"
  | "select_warehouse"
  | "home";

export interface UserSessionContext {
  userId: string;
  fullName: string | null;
  phone: string;
  initials: string;
  role: UserRole | null;
  roleLabel: string;
  tenantName: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
}

export interface SendOtpResult {
  challengeId: string;
  sentTo: string;
}

export interface VerifyOtpResult {
  session: AuthSession;
  nextStep: NextStep;
  warehouses?: Warehouse[];
}
