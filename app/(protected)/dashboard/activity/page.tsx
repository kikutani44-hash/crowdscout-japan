import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase";

export const revalidate = 0;

const ACTION_LABEL: Record<string, string> = {
  translate:       "🗣️ 翻訳",
  cf_check:        "🇯🇵 CF確認",
  market_analysis: "📊 市場分析",
  offer_open:      "✉️ オファー",
  status_change:   "🔄 ステータス変更",
  view_pipeline:   "🗂️ パイプライン",
  external_link:   "🔗 元ページ閲覧",
  page_view:       "👁️ ページ閲覧",
  card_click:      "🖱️ カードタップ",
  filter_use:      "🔍 フィルター使用",
};

type Log = {
  id: string;
  guest_id: string;
  action: string;
  project_title: string | null;
  metadata: Record<string, string> | null;
  created_at: string;
};

type GuestSummary = {
  guest_id: string;
  actions: Record<string, number>;
  projects: Set<string>;
  last_seen: string;
};

export default async function ActivityPage() {
  const supabase = createServerSupabase();
  const { data: logs } = await supabase
    .from("guest_activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500) as { data: Log[] | null };

  const rows = logs ?? [];

  // ゲストごとにサマリー集計
  const summaryMap = new Map<string, GuestSummary>();
  for (const log of rows) {
    if (!summaryMap.has(log.guest_id)) {
      summaryMap.set(log.guest_id, {
        guest_id: log.guest_id,
        actions: {},
        projects: new Set(),
        last_seen: log.created_at,
      });
    }
    const s = summaryMap.get(log.guest_id)!;
    s.actions[log.action] = (s.actions[log.action] ?? 0) + 1;
    if (log.project_title) s.projects.add(log.project_title);
    if (log.created_at > s.last_seen) s.last_seen = log.created_at;
  }
  const summaries = Array.from(summaryMap.values()).sort(
    (a, b) => b.last_seen.localeCompare(a.last_seen)
  );

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/40 px-4 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">📋 ゲスト行動ログ</h1>
            <p className="text-sm text-muted-foreground">直近500件 · ゲストの行動を可視化</p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            ダッシュボードへ
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">

        {/* ゲストサマリー */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">ゲスト別サマリー</h2>
          {summaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだログがありません</p>
          ) : (
            <div className="space-y-3">
              {summaries.map((s) => (
                <div key={s.guest_id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-mono text-muted-foreground mb-1">
                        ID: {s.guest_id}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(s.actions).map(([action, count]) => (
                          <span
                            key={action}
                            className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs"
                          >
                            {ACTION_LABEL[action] ?? action} ×{count}
                          </span>
                        ))}
                      </div>
                      {s.projects.size > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          関心案件: {Array.from(s.projects).slice(0, 5).join(" / ")}
                          {s.projects.size > 5 && ` 他${s.projects.size - 5}件`}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">最終アクセス</p>
                      <p className="text-sm font-medium">{fmt(s.last_seen)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        計{Object.values(s.actions).reduce((a, b) => a + b, 0)}アクション
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 時系列ログ */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">時系列ログ</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card/60 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3">日時 (JST)</th>
                  <th className="px-4 py-3">ゲストID</th>
                  <th className="px-4 py-3">アクション</th>
                  <th className="px-4 py-3">案件</th>
                  <th className="px-4 py-3">詳細</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      まだログがありません
                    </td>
                  </tr>
                ) : (
                  rows.map((log) => (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {fmt(log.created_at)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                        {log.guest_id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {ACTION_LABEL[log.action] ?? log.action}
                      </td>
                      <td className="px-4 py-2 text-xs max-w-[200px] truncate">
                        {log.project_title ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {log.metadata
                          ? log.metadata.from
                            ? `${log.metadata.from} → ${log.metadata.to}`
                            : ""
                          : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
