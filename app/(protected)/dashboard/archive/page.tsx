import Link from "next/link";
import { fetchProjects } from "@/lib/supabase";
import { getDisplayTitle } from "@/lib/project-translation";
import { formatUsd } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

export const revalidate = 0;

export default async function ArchivePage() {
  const projects = await fetchProjects({ archivedOnly: true, sortBy: "score" });
  const japanUnenteredCount = projects.filter((p) => {
    const r = p.japan_cf_result;
    return r ? r.isJapanUnentered : true;
  }).length;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/40 px-4 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">📦 過去のサクセス案件</h1>
            <p className="text-sm text-muted-foreground">
              終了から180〜730日の案件 · 日本未参入の可能性あり
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

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex gap-4 text-sm">
          <span className="rounded-lg border border-border bg-card px-4 py-2">
            アーカイブ総数 <strong>{projects.length}件</strong>
          </span>
          <span className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-amber-400">
            日本未参入 <strong>{japanUnenteredCount}件</strong>
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
            <p className="text-4xl mb-3">💎</p>
            <p>まだアーカイブ案件がありません。</p>
            <p className="text-xs mt-2">クロールを実行すると 180〜730日前に終了した案件が追加されます。</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const isJapanUnentered = p.japan_cf_result
                ? p.japan_cf_result.isJapanUnentered
                : true;
              return (
                <a
                  key={p.id}
                  href={p.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-border bg-card p-4 transition hover:border-amber-500/40 hover:bg-amber-500/5"
                >
                  {p.image_url && (
                    <img
                      src={p.image_url}
                      alt={p.title}
                      className="mb-3 h-36 w-full rounded-lg object-cover"
                    />
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium line-clamp-2">{getDisplayTitle(p)}</p>
                    {isJapanUnentered && (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-amber-500/40 text-amber-400 text-[10px]"
                      >
                        🇯🇵 未参入
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.platform} · {formatUsd(p.raised_usd)} · スコア {p.score}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {p.offer_status}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {p.category}
                    </Badge>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
