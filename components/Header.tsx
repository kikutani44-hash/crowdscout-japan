"use client";

import Link from "next/link";
import Image from "next/image";
import { BarChart3, LogOut, Mail } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { authRoleLabel } from "@/lib/auth-types";
import { GmailAlertBell } from "@/components/GmailAlertBell";
import { useState } from "react";

interface HeaderProps {
  totalRaisedJpy: number;
  totalProjects: number;
  japanUnenteredCount: number;
}

export function Header({ totalRaisedJpy, totalProjects, japanUnenteredCount }: HeaderProps) {
  const { role, logout } = useAuth();
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<string | null>(null);

  const handleBatchFetch = async () => {
    setFetching(true);
    setFetchResult(null);
    try {
      const res = await fetch("/api/contact-search/batch", { method: "POST" });
      const data = await res.json();
      setFetchResult(`完了: ${data.processed}件処理・${data.found}件メール取得`);
    } catch {
      setFetchResult("エラーが発生しました");
    } finally {
      setFetching(false);
    }
  };

  return (
    <header className="border-b border-border bg-card/40 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg">
            <Image src="/icons/icon-96x96.png" alt="CrowdJARVIS" width={40} height={40} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Crowd JARVIS</h1>
            <p className="text-xs text-muted-foreground">
              海外クラファン案件発掘・日本独占権獲得
              {role && (
                <span className="ml-2 rounded bg-secondary/60 px-1.5 py-0.5 text-[10px]">
                  {authRoleLabel(role)}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-muted-foreground">案件総売上（円換算）</p>
            <p className="text-lg font-semibold text-primary">
              ¥{totalRaisedJpy.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">登録案件</p>
            <p className="text-lg font-semibold">{totalProjects}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">🇯🇵 未参入</p>
            <p className="text-lg font-semibold text-emerald-400">{japanUnenteredCount}</p>
          </div>
          <Link
            href="/dashboard/archive"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            📦 過去案件
          </Link>
          <Link
            href="/dashboard/pipeline"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            🗂️ パイプライン
          </Link>
          {role === "admin" && (
            <Link
              href="/dashboard/activity"
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
            >
              📋 行動ログ
            </Link>
          )}
          {role === "admin" && (
            <div className="flex flex-col items-end gap-0.5">
              <button
                type="button"
                onClick={handleBatchFetch}
                disabled={fetching}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
                title="maker_websiteからメールアドレスを一括取得"
              >
                <Mail className="h-4 w-4" />
                {fetching ? "取得中..." : "メール一括取得"}
              </button>
              {fetchResult && (
                <span className="text-[10px] text-muted-foreground">{fetchResult}</span>
              )}
            </div>
          )}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            <BarChart3 className="h-4 w-4" />
            ダッシュボード
          </Link>
          <GmailAlertBell />
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            ログアウト
          </button>
        </div>
      </div>
    </header>
  );
}
