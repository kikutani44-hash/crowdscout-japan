"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/AuthProvider";
import {
  GUEST_EXPIRY_OPTIONS,
  type GuestExpiryOption,
  type PasswordRecord,
} from "@/lib/auth-types";
import { cn } from "@/lib/utils";
import { Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";

function formatExpiresAt(iso: string | null): string {
  if (!iso) return "無期限";
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GuestPasswordIssuer() {
  const { token, role } = useAuth();
  const [passwords, setPasswords] = useState<PasswordRecord[]>([]);
  const [issued, setIssued] = useState<PasswordRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<GuestExpiryOption>("1week");

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [token]
  );

  const loadPasswords = useCallback(async () => {
    if (!token || role !== "admin") return;
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/guest", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "一覧の取得に失敗しました");
      setPasswords(data.passwords ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "一覧の取得に失敗しました");
    } finally {
      setLoadingList(false);
    }
  }, [authHeaders, role, token]);

  useEffect(() => {
    loadPasswords();
  }, [loadPasswords]);

  const handleIssue = async () => {
    if (!token || role !== "admin") return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/guest", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ expiry }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "発行に失敗しました");
      setIssued(data.password);
      await loadPasswords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "発行に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || role !== "admin") return;
    if (!window.confirm("このゲストコードを削除しますか？")) return;

    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/auth/guest/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "削除に失敗しました");
      if (issued?.id === id) setIssued(null);
      await loadPasswords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode(null), 2000);
  };

  if (role !== "admin") return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-col gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound className="h-5 w-5 text-primary" />
            ゲストパスワード発行
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            共有用コードを発行します。有効期限を選んでから発行してください。
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">有効期限</p>
            <div className="flex flex-wrap gap-2">
              {GUEST_EXPIRY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setExpiry(option.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition",
                    expiry === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary/40 text-foreground hover:border-primary/50"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleIssue} disabled={loading} className="shrink-0">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                発行中...
              </>
            ) : (
              "ゲストパスワード発行"
            )}
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {issued && (
        <div className="mb-4 rounded-lg border border-primary/40 bg-primary/10 p-4">
          <p className="text-sm text-muted-foreground">新しいゲストコード</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="text-lg font-semibold tracking-wider text-primary">{issued.code}</code>
            <Button size="sm" variant="outline" onClick={() => copyCode(issued.code)}>
              {copiedCode === issued.code ? (
                <>
                  <Check className="h-4 w-4" />
                  コピー済み
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  コピー
                </>
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            有効期限: {formatExpiresAt(issued.expires_at)}
          </p>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">有効なゲストコード</p>
        {loadingList ? (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        ) : passwords.length === 0 ? (
          <p className="text-sm text-muted-foreground">有効なゲストコードはありません</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {passwords.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <code className="font-medium">{item.code}</code>
                  <p className="text-xs text-muted-foreground">
                    期限: {formatExpiresAt(item.expires_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{item.expires_at ? "有効" : "無期限"}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => copyCode(item.code)}>
                    {copiedCode === item.code ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
