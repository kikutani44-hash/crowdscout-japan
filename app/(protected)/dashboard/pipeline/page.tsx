import Link from "next/link";
import { fetchProjects } from "@/lib/supabase";
import { getDisplayTitle } from "@/lib/project-translation";
import { formatUsd } from "@/lib/utils";
import { formatEndDate, formatMonthsSinceEnd } from "@/lib/project-momentum";
import { estimateJapanPrice, japanPriceVerdict } from "@/lib/japan-price";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, Globe, ExternalLink } from "lucide-react";
import type { OfferStatus } from "@/lib/types";

export const revalidate = 0;

const STATUSES: { status: OfferStatus; id: string }[] = [
  { status: "ウォッチ中", id: "watch" },
  { status: "交渉中",    id: "negotiating" },
  { status: "獲得済み",  id: "acquired" },
  { status: "未接触",   id: "untouched" },
  { status: "却下",     id: "rejected" },
];

const STATUS_STYLE: Record<OfferStatus, { badge: string; dot: string }> = {
  "未接触":   { badge: "border-slate-500/40 text-slate-400",  dot: "bg-slate-400" },
  "ウォッチ中": { badge: "border-blue-500/40 text-blue-400",   dot: "bg-blue-400" },
  "交渉中":   { badge: "border-amber-500/40 text-amber-400", dot: "bg-amber-400" },
  "獲得済み":  { badge: "border-green-500/40 text-green-400", dot: "bg-green-400" },
  "却下":    { badge: "border-red-500/40 text-red-400",     dot: "bg-red-400" },
};

type ViewFilter = "all" | "archived" | "active";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams?: { view?: string };
}) {
  // 過去案件(archived)もパイプラインには表示する。
  // ウォッチは付けられるのに一覧に出ない、という取りこぼしを防ぐため。
  const all = await fetchProjects({ sortBy: "score", includeArchived: true });

  const rawView = searchParams?.view;
  const view: ViewFilter =
    rawView === "archived" || rawView === "active" ? rawView : "all";

  // 過去案件から先にオファーをかける運用のため、過去だけに絞り込めるようにする
  const projects =
    view === "archived"
      ? all.filter((p) => p.status === "archived")
      : view === "active"
        ? all.filter((p) => p.status !== "archived")
        : all;

  const archivedCount = all.filter((p) => p.status === "archived").length;

  const byStatus: Record<OfferStatus, typeof projects> = {
    "未接触": [],
    "ウォッチ中": [],
    "交渉中": [],
    "獲得済み": [],
    "却下": [],
  };
  for (const p of projects) {
    if (p.offer_status in byStatus) {
      byStatus[p.offer_status].push(p);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/40 px-4 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">🗂️ パイプライン管理</h1>
            <p className="text-sm text-muted-foreground">
              ステータス別に案件を管理 · 計 {projects.length}件
            </p>
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

      {/* 過去案件 / 現行案件の絞り込み */}
      <div className="border-b border-border bg-card/10">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-sm">
          <span className="mr-1 text-muted-foreground">表示:</span>
          {(
            [
              { key: "all", label: "すべて", count: all.length },
              { key: "archived", label: "📦 過去案件のみ", count: archivedCount },
              { key: "active", label: "進行中のみ", count: all.length - archivedCount },
            ] as const
          ).map((tab) => (
            <Link
              key={tab.key}
              href={tab.key === "all" ? "/dashboard/pipeline" : `/dashboard/pipeline?view=${tab.key}`}
              className={`rounded-full border px-3 py-1.5 transition ${
                view === tab.key
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 font-bold">{tab.count}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* サマリーバー */}
      <div className="border-b border-border bg-card/20">
        <div className="mx-auto flex max-w-7xl gap-3 overflow-x-auto px-4 py-3">
          {STATUSES.map(({ status, id }) => (
            <a
              key={id}
              href={`#${id}`}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-secondary"
            >
              <span className={`h-2 w-2 rounded-full ${STATUS_STYLE[status].dot}`} />
              {status}
              <span className="font-bold">{byStatus[status].length}</span>
            </a>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8">
        {STATUSES.map(({ status, id }) => {
          const list = byStatus[status];
          const style = STATUS_STYLE[status];
          return (
            <section key={id} id={id}>
              <div className="mb-4 flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${style.dot}`} />
                <h2 className="text-lg font-semibold">{status}</h2>
                <span className="text-sm text-muted-foreground">{list.length}件</span>
              </div>

              {list.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card/20 px-6 py-4 text-sm text-muted-foreground">
                  該当案件なし
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {list.map((p) => {
                    const isJapanUnentered = p.japan_cf_result
                      ? p.japan_cf_result.isJapanUnentered
                      : true;
                    return (
                      <div
                        key={p.id}
                        className="rounded-xl border border-border bg-card p-4 transition hover:border-border/80 hover:bg-card/80"
                      >
                        {p.image_url && (
                          <img
                            src={p.image_url}
                            alt={p.title}
                            className="mb-3 h-32 w-full rounded-lg object-cover"
                          />
                        )}

                        <p className="text-sm font-medium line-clamp-2 leading-snug">
                          {getDisplayTitle(p)}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {p.platform} · {formatUsd(p.raised_usd)}
                          {p.backers > 0 && ` · ${p.backers.toLocaleString()}人`}
                        </p>

                        {(() => {
                          // 日本での想定価格（計算のみ・クレジット消費なし）
                          const jp = estimateJapanPrice(p.raised_usd, p.backers);
                          const v = japanPriceVerdict(jp);
                          if (!jp) return null;
                          return (
                            <p
                              className={`mt-1 text-xs ${
                                v?.level === "very-high"
                                  ? "text-red-400"
                                  : v?.level === "high"
                                    ? "text-amber-400"
                                    : "text-emerald-400"
                              }`}
                              title="海外CF価格の30〜50%で卸してもらえた場合の日本での想定販売価格。卸掛率は交渉次第で動くため目安です。"
                            >
                              🇯🇵 日本CF想定 {jp.shortLabel}
                              <span className="text-muted-foreground"> （海外 {jp.overseasLabel}）</span>
                            </p>
                          );
                        })()}

                        <div className="mt-2 flex flex-wrap gap-1">
                          <Badge variant="outline" className={`text-[10px] ${style.badge}`}>
                            {p.offer_status}
                          </Badge>
                          {p.status === "archived" && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-purple-500/40 text-purple-400"
                              title={
                                formatEndDate(p.deadline_at)
                                  ? `終了日: ${formatEndDate(p.deadline_at)}`
                                  : undefined
                              }
                            >
                              📦 過去案件
                              {formatMonthsSinceEnd(p.deadline_at)
                                ? ` · ${formatMonthsSinceEnd(p.deadline_at)}終了`
                                : ""}
                            </Badge>
                          )}
                          {isJapanUnentered && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">
                              🇯🇵 未参入
                            </Badge>
                          )}
                          {p.category && (
                            <Badge variant="secondary" className="text-[10px]">
                              {p.category.split("/").pop()}
                            </Badge>
                          )}
                        </div>

                        {p.offer_note && (
                          <p className="mt-2 text-xs text-muted-foreground line-clamp-2 italic">
                            {p.offer_note}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Link
                            href={`/?project=${p.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-[11px] text-primary hover:bg-primary/10"
                          >
                            📋 案件へ
                          </Link>
                          <a
                            href={p.original_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary"
                          >
                            <ExternalLink className="h-3 w-3" />
                            元ページ
                          </a>
                          {p.maker_email && (
                            <a
                              href={`mailto:${p.maker_email}`}
                              className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 px-2 py-1 text-[11px] text-blue-400 hover:bg-blue-500/10"
                            >
                              <Mail className="h-3 w-3" />
                              メール
                            </a>
                          )}
                          {!p.maker_email && p.maker_contact_form && (
                            <a
                              href={p.maker_contact_form}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 px-2 py-1 text-[11px] text-blue-400 hover:bg-blue-500/10"
                            >
                              <Globe className="h-3 w-3" />
                              問い合わせ
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
