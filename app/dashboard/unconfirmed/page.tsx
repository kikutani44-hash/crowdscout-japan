import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UnconfirmedContactsTable } from "@/components/UnconfirmedContactsTable";
import { fetchProjects } from "@/lib/supabase";

export default async function UnconfirmedContactsPage() {
  const projects = await fetchProjects();

  // 連絡先が完全に揃っていない案件のみ（メールもフォームもない）
  const allUnconfirmed = projects
    .filter((p) => !p.maker_email && !p.maker_contact_form)
    .sort((a, b) => b.score - a.score);

  // 🟡 サイトあり・連絡先なし（サイトを開けば見つかる可能性あり）
  const hasSiteOnly = allUnconfirmed.filter((p) => p.maker_website);

  // 🔴 何もなし（SNS・Google調査が必要）
  const noContact = allUnconfirmed.filter((p) => !p.maker_website);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/40 px-4 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">メーカー連絡先 調査リスト</h1>
            <p className="text-sm text-muted-foreground">
              サイト確認 {hasSiteOnly.length}件 · 要調査 {noContact.length}件
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

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">

        {/* 凡例 */}
        <div className="flex flex-wrap gap-4 rounded-xl border border-border bg-card p-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
            <span className="text-muted-foreground">送信可（メール or フォームあり）→</span>
            <Link href="/dashboard/outreach" className="text-primary hover:underline">オファー管理ページへ</Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-amber-500"></span>
            <span className="text-muted-foreground">🟡 サイト確認 — 公式サイトを開いて連絡先を探して入力</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500"></span>
            <span className="text-muted-foreground">🔴 要調査 — SNS・Googleで検索が必要（困難案件）</span>
          </div>
        </div>

        {/* 🟡 サイトあり・連絡先なし */}
        {hasSiteOnly.length > 0 && (
          <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
            <h2 className="mb-1 text-lg font-semibold">
              🟡 サイト確認
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {hasSiteOnly.length}件 — 公式サイトあり・連絡先未取得
              </span>
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              「サイトを開く」ボタンでメーカーサイトを確認し、メールアドレスまたはお問い合わせフォームのURLを入力・保存してください。
            </p>
            <UnconfirmedContactsTable projects={hasSiteOnly} showSiteButton />
          </section>
        )}

        {/* 🔴 何もなし */}
        {noContact.length > 0 && (
          <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
            <h2 className="mb-1 text-lg font-semibold">
              🔴 要調査
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {noContact.length}件 — 公式サイト未確認・SNS調査が必要
              </span>
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Google・Instagram・X・LinkedInで検索して連絡先を探してください。見つからない場合はスキップで構いません。
            </p>
            <UnconfirmedContactsTable projects={noContact} />
          </section>
        )}

      </main>
    </div>
  );
}
