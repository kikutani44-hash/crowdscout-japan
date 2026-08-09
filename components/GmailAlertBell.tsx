"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

interface ReplyThread {
  threadId: string;
  makerEmail: string;
  lastDate: string;
  hasReply: boolean;
  messages: { subject: string }[];
}

const SEEN_KEY = "gmail_seen_threads";

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markSeen(ids: string[]) {
  try {
    const existing = getSeenIds();
    ids.forEach((id) => existing.add(id));
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(existing)));
  } catch {}
}

export function GmailAlertBell() {
  const [replies, setReplies] = useState<ReplyThread[]>([]);
  const [unreadIds, setUnreadIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const fetchReplies = async () => {
    try {
      const res = await fetch("/api/gmail/inbox");
      const data = await res.json();
      if (!data.configured) { setConfigured(false); return; }
      const replied: ReplyThread[] = (data.threads ?? []).filter((t: ReplyThread) => t.hasReply);
      setReplies(replied);
      const seen = getSeenIds();
      setUnreadIds(replied.map((t) => t.threadId).filter((id) => !seen.has(id)));
    } catch {}
  };

  useEffect(() => {
    fetchReplies();
    const timer = setInterval(fetchReplies, 10 * 60 * 1000); // 10分ごと
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open && unreadIds.length > 0) {
      markSeen(unreadIds);
      setUnreadIds([]);
    }
  };

  if (!configured) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
        title="返信アラート"
      >
        <Bell className="h-4 w-4" />
        {unreadIds.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadIds.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-border bg-card shadow-xl">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">📬 返信アラート</p>
          </div>
          {replies.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              返信はまだありません
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-border">
              {replies.map((t) => {
                const isUnread = !getSeenIds().has(t.threadId);
                return (
                  <li key={t.threadId} className={`px-4 py-3 ${isUnread ? "bg-primary/5" : ""}`}>
                    <p className="text-xs font-medium truncate">
                      {isUnread && <span className="mr-1 text-red-400">●</span>}
                      {t.messages[0]?.subject || "(件名なし)"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">{t.makerEmail}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{t.lastDate}</p>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-border px-4 py-2 text-center">
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Gmailで開く →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
