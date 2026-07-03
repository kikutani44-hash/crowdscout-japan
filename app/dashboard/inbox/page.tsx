import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { GmailInbox } from "@/components/GmailInbox";

export default function InboxPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/40 px-4 py-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Mail className="h-6 w-6 text-primary" />
              メール受信ボックス
            </h1>
            <p className="text-sm text-muted-foreground">
              送信済みオファー · メーカーからの返信を一覧表示
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/api/gmail/connect"
              className="inline-flex items-center gap-2 rounded-md border border-primary/40 px-3 py-2 text-sm text-primary hover:bg-primary/5"
            >
              <Mail className="h-4 w-4" />
              Gmail 再接続
            </a>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
            >
              <ArrowLeft className="h-4 w-4" />
              ダッシュボードへ
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* 説明 */}
        <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="font-medium">📌 このページについて</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>• オファーを送ったメーカーのメールアドレス宛の送受信スレッドを自動表示します</li>
            <li>• <span className="text-emerald-400 font-medium">返信あり</span>（緑）は優先的に対応してください</li>
            <li>• 「スレッドを見る」で会話の流れを確認できます</li>
            <li>• 初回は「Gmail と接続する」ボタンで認証が必要です</li>
          </ul>
        </div>

        <GmailInbox />
      </main>
    </div>
  );
}
