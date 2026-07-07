"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";

export function CrawlButton() {
  const { role, token } = useAuth();
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [count, setCount] = useState<number | null>(null);
  const [zeczecStatus, setZeczecStatus] = useState<"idle" | "running" | "done" | "error">("idle");

  const handleCrawl = async () => {
    setStatus("running");
    setCount(null);
    try {
      const res = await fetch("/api/crawl", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCount(data.count);
      setStatus("done");
      setTimeout(() => window.location.reload(), 2000);
    } catch {
      setStatus("error");
    }
  };

  const handleZeczecCrawl = async () => {
    setZeczecStatus("running");
    try {
      const res = await fetch("/api/crawl-zeczec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error();
      setZeczecStatus("done");
    } catch {
      setZeczecStatus("error");
    }
  };

  if (role !== "admin") return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <RefreshCw className="h-5 w-5 text-primary" />
            データ更新
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kickstarterから最新データを取得してリフレッシュします
          </p>
        </div>
        <Button
          onClick={handleCrawl}
          disabled={status === "running"}
          variant={status === "error" ? "destructive" : "default"}
        >
          <RefreshCw className={`h-4 w-4 ${status === "running" ? "animate-spin" : ""}`} />
          {status === "idle" && "データ更新"}
          {status === "running" && "取得中...（数分かかります）"}
          {status === "done" && `完了！${count}件取得 → 再読み込み中`}
          {status === "error" && "エラー（再試行）"}
        </Button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
        <div>
          <p className="font-medium text-sm">🇹🇼 Zeczec（台湾）再クロール</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            台湾製品データを更新します（GitHub Actionsで実行・約10分）
          </p>
        </div>
        <Button
          onClick={handleZeczecCrawl}
          disabled={zeczecStatus === "running"}
          variant={zeczecStatus === "error" ? "destructive" : "secondary"}
          size="sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${zeczecStatus === "running" ? "animate-spin" : ""}`} />
          {zeczecStatus === "idle" && "Zeczec更新"}
          {zeczecStatus === "running" && "ジョブ送信中..."}
          {zeczecStatus === "done" && "✓ ジョブ開始！（約10分で完了）"}
          {zeczecStatus === "error" && "エラー（再試行）"}
        </Button>
      </div>
    </section>
  );
}
