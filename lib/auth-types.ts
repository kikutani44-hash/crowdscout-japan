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

export function authRoleLabel(role: AuthRole): string {
  return role === "admin" ? "管理者" : "ゲスト";
}
