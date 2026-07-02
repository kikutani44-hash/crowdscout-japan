import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fetchProjects } from "@/lib/supabase";
import { OutreachQueue } from "@/components/OutreachQueue";
import { FollowUpQueue } from "@/components/FollowUpQueue";

export default async function OutreachPage() {
  const projects = await fetchProjects();

  // 送信キュー: 未接触 & (メール or フォームあり)
  const sendQueue = projects
    .filter((p) => p.offer_status === "未接触" && (p.maker_email || p.maker_contact_form))
    .sort((a, b) => b.score - a.score);

  // フォローアップキュー: 交渉中（送信済み）
  const followUpQueue = projects
    .filter((p) => p.offer_status === "交渉中")
    .sort((a, b) => {
      // 送信日が古い順（フォローアップ優先度高い）
      const dateA = a.offer_sent_at ? new Date(a.offer_sent_at).getTime() : 0;
      const dateB = b.offer_sent_at ? new Date(b.offer_sent_at).getTime() : 0;
      return dateA - dateB;
    });

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/40 px-4 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">オファー管理</h1>
            <p className="text-sm text-muted-foreground">
              送信キュー {sendQueue.length}件 · フォローアップ {followUpQueue.length}件
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

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        {/* フォローアップキュー */}
        {followUpQueue.length > 0 && (
          <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
            <h2 className="mb-1 text-lg font-semibold">
              📬 フォローアップキュー
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {followUpQueue.length}件 — 送信済み・返信待ち
              </span>
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              7日以上経過した案件には2通目（日本市場レポート）を送るタイミングです
            </p>
            <FollowUpQueue projects={followUpQueue} />
          </section>
        )}

        {/* 送信キュー */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-1 text-lg font-semibold">
            📤 送信キュー
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {sendQueue.length}件 — スコア順・連絡先確認済み
            </span>
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            メールアドレスまたはコンタクトフォームが確認済みの未接触案件です
          </p>
          <OutreachQueue projects={sendQueue} />
        </section>
      </main>
    </div>
  );
}
