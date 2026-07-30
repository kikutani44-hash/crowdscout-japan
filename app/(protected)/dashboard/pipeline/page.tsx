import Link from "next/link";
import { fetchProjects } from "@/lib/supabase";
import { getDisplayTitle } from "@/lib/project-translation";
import { formatUsd } from "@/lib/utils";
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

export default async function PipelinePage() {
  const projects = await fetchProjects({ sortBy: "score" });

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

                        <div className="mt-2 flex flex-wrap gap-1">
                          <Badge variant="outline" className={`text-[10px] ${style.badge}`}>
                            {p.offer_status}
                          </Badge>
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
