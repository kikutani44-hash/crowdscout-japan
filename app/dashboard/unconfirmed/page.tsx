import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UnconfirmedContactsTable } from "@/components/UnconfirmedContactsTable";
import { fetchProjects } from "@/lib/supabase";

export default async function UnconfirmedContactsPage() {
  const projects = await fetchProjects();
  const unconfirmed = projects
    .filter((p) => !p.maker_website)
    .sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/40 px-4 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">メーカー連絡先 未確認リスト</h1>
            <p className="text-sm text-muted-foreground">
              公式サイト・メールアドレスが未確認の案件（{unconfirmed.length}件）
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
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="mb-4 text-xs text-muted-foreground">
            案件名をクリックするとクラファンページが開きます。Google・SNSボタンで連絡先を調べて入力・保存してください。
          </p>
          <UnconfirmedContactsTable projects={unconfirmed} />
        </section>
      </main>
    </div>
  );
}
