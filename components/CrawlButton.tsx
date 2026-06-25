"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";

export function CrawlButton() {
  const { role } = useAuth();
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [count, setCount] = useState<number | null>(null);

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

  if (role !== "admin") return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
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
    </section>
  );
}
