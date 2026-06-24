"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LoginScreen } from "@/components/LoginScreen";
import {
  AUTH_TOKEN_STORAGE_KEY,
  type AuthRole,
} from "@/lib/auth-types";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  role: AuthRole | null;
  expiresAt: string | null;
  token: string | null;
  login: (password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<AuthRole | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const clearSession = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setToken(null);
    setRole(null);
    setExpiresAt(null);
  }, []);

  const applySession = useCallback((nextToken: string, nextRole: AuthRole, nextExpiresAt: string | null) => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, nextToken);
    setToken(nextToken);
    setRole(nextRole);
    setExpiresAt(nextExpiresAt);
  }, []);

  const verifyStoredToken = useCallback(async (storedToken: string) => {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: storedToken }),
    });
    const data = await res.json();
    if (!res.ok || !data.valid) {
      clearSession();
      return;
    }
    applySession(storedToken, data.role, data.expiresAt ?? null);
  }, [applySession, clearSession]);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }
    verifyStoredToken(stored).finally(() => setIsLoading(false));
  }, [verifyStoredToken]);

  const login = useCallback(async (password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "ログインに失敗しました");
    }
    applySession(data.token, data.role, data.expiresAt ?? null);
  }, [applySession]);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token && role),
      isLoading,
      role,
      expiresAt,
      token,
      login,
      logout,
    }),
    [token, role, expiresAt, isLoading, login, logout]
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a]">
        <p className="text-sm text-muted-foreground">認証を確認しています...</p>
      </div>
    );
  }

  if (!value.isAuthenticated) {
    return <LoginScreen onLogin={login} />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
