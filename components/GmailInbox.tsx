"use client";

import { useCallback, useEffect, useState } from "react";
import type { GmailThread } from "@/lib/gmail-client";
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Inbox, Loader2, Mail, RefreshCw } from "lucide-react";

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function MessageBubble({
  message,
}: {
  message: GmailThread["messages"][0];
}) {
  const isReply = message.isReply;
  return (
    <div className={`flex ${isReply ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
          isReply
            ? "bg-secondary text-foreground"
            : "bg-primary/10 text-foreground"
        }`}
      >
        <p className="mb-1 text-[10px] text-muted-foreground">
          {isReply ? "📨 メーカーから" : "📤 あなたから"} · {formatDate(message.date)}
        </p>
        <p className="whitespace-pre-wrap text-xs leading-relaxed">{message.snippet}</p>
      </div>
    </div>
  );
}

function ThreadCard({ thread }: { thread: GmailThread }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-lg border ${
        thread.hasReply
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-border bg-secondary/10"
      } p-3`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {thread.hasReply ? (
              <span className="shrink-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                返信あり
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                未返信
              </span>
            )}
            <span className="truncate text-xs font-medium text-muted-foreground">
              {thread.makerEmail}
            </span>
          </div>
          {thread.messages[0] && (
            <p className="mt-1 truncate text-sm font-medium">
              {thread.messages[0].subject || "(件名なし)"}
            </p>
          )}
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {thread.messages[thread.messages.length - 1]?.snippet}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-muted-foreground">
            {formatDate(thread.lastDate)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {thread.messages.length}通
          </p>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> 折りたたむ
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> スレッドを見る
              </>
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {thread.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <a
            href={`https://mail.google.com/mail/u/0/#search/${encodeURIComponent(thread.makerEmail)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Gmailで開く
          </a>
        </div>
      )}
    </div>
  );
}

export function GmailInbox() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [threads, setThreads] = useState<GmailThread[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "replied" | "unreplied">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/inbox");
      const data = await res.json();
      setConfigured(data.configured);
      setThreads(data.threads ?? []);
    } catch {
      setError("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Gmail を確認中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
        <AlertTriangle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <Mail className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h3 className="mb-1 font-semibold">Gmail 未接続</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Google Cloud Console で OAuth 認証情報を作成し、.env.local に設定後、下のボタンで接続してください。
        </p>
        <a
          href="/api/gmail/connect"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Mail className="h-4 w-4" />
          Gmail と接続する
        </a>
      </div>
    );
  }

  const filtered = threads.filter((t) => {
    if (filter === "replied") return t.hasReply;
    if (filter === "unreplied") return !t.hasReply;
    return true;
  });

  const repliedCount = threads.filter((t) => t.hasReply).length;
  const unrepliedCount = threads.filter((t) => !t.hasReply).length;

  return (
    <div className="space-y-4">
      {/* サマリー */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 text-sm">
          <span className="text-emerald-400 font-medium">📨 返信あり: {repliedCount}件</span>
          <span className="text-muted-foreground">📤 未返信: {unrepliedCount}件</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {(["all", "replied", "unreplied"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 transition ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {f === "all" ? "すべて" : f === "replied" ? "返信あり" : "未返信"}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1 rounded border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" />
            更新
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <Inbox className="h-8 w-8" />
          <p className="text-sm">該当スレッドがありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((thread) => (
            <ThreadCard key={thread.threadId} thread={thread} />
          ))}
        </div>
      )}
    </div>
  );
}
