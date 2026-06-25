export type PasswordType = "admin" | "guest";

export interface PasswordRecord {
  id: string;
  code: string;
  type: PasswordType;
  created_at: string;
  expires_at: string | null;
}

export type AuthRole = PasswordType;

export interface AuthTokenPayload {
  role: AuthRole;
  exp: number;
  iat: number;
  guestId?: string;
}

export const AUTH_TOKEN_STORAGE_KEY = "crowdscout_auth_token";

export const GUEST_PASSWORD_TTL_DAYS = 7;

export type GuestExpiryOption = "1day" | "1week" | "1month" | "unlimited";

export const GUEST_EXPIRY_OPTIONS: { value: GuestExpiryOption; label: string }[] = [
  { value: "1day", label: "1日" },
  { value: "1week", label: "1週間" },
  { value: "1month", label: "1ヶ月" },
  { value: "unlimited", label: "無期限" },
];

export function authRoleLabel(role: AuthRole): string {
  return role === "admin" ? "管理者" : "ゲスト";
}
