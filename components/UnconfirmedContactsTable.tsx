"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";
import { ExternalLink, Instagram, Loader2, Search, Twitter } from "lucide-react";

interface RowState {
  maker_website: string;
  maker_email: string;
  maker_contact_form: string;
  maker_instagram: string;
  maker_twitter: string;
  maker_facebook: string;
  saving: boolean;
  saved: boolean;
  skipped: boolean;
  searching: boolean;
  error: string | null;
}

function initialRowState(p: Project): RowState {
  return {
    maker_website: p.maker_website ?? "",
    maker_email: p.maker_email ?? "",
    maker_contact_form: p.maker_contact_form ?? "",
    maker_instagram: p.maker_instagram ?? "",
    maker_twitter: p.maker_twitter ?? "",
    maker_facebook: p.maker_facebook ?? "",
    saving: false,
    saved: false,
    skipped: false,
    searching: false,
    error: null,
  };
}

function extractBrand(title: string): string {
  return title.split(/[:—–|]/)[0].trim();
}

const PLATFORM_LABELS: Record<string, string> = {
  kickstarter: "KS",
  indiegogo: "IGG",
  zeczec: "Zeczec",
  makuake: "Makuake",
  wadiz: "Wadiz",
};

function SearchButtons({ title }: { title: string }) {
  const brand = extractBrand(title);
  const buttons = [
    {
      label: "Google",
      href: `https://www.google.com/search?q=${encodeURIComponent(brand + " official site contact email")}`,
      color: "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20",
    },
    {
      label: "Instagram",
      href: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(brand)}`,
      color: "bg-pink-500/10 text-pink-400 hover:bg-pink-500/20",
    },
    {
      label: "X",
      href: `https://x.com/search?q=${encodeURIComponent(brand)}&f=user`,
      color: "bg-secondary text-muted-foreground hover:text-foreground",
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(brand)}`,
      color: "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20",
    },
  ];

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {buttons.map((b) => (
        <a
          key={b.label}
          href={b.href}
          target="_blank"
          rel="noreferrer"
          className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${b.color}`}
        >
          {b.label}
        </a>
      ))}
    </div>
  );
}

function SnsLinks({ row }: { row: RowState }) {
  const links = [
    { label: "Instagram", url: row.maker_instagram, icon: "🟣" },
    { label: "X / Twitter", url: row.maker_twitter, icon: "⬛" },
    { label: "Facebook", url: row.maker_facebook, icon: "🔵" },
  ].filter((l) => l.url);

  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.url!}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          {l.icon} {l.label}
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      ))}
    </div>
  );
}

export function UnconfirmedContactsTable({
  projects,
  showSiteButton = false,
}: {
  projects: Project[];
  showSiteButton?: boolean;
}) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(projects.map((p) => [p.id, initialRowState(p)]))
  );

  function updateField(
    id: string,
    field: keyof Pick<RowState, "maker_website" | "maker_email" | "maker_contact_form" | "maker_instagram" | "maker_twitter" | "maker_facebook">,
    value: string
  ) {
    setRows((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, saved: false, error: null },
    }));
  }

  async function autoSearch(id: string, title: string, existingWebsite?: string | null) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], searching: true, error: null } }));
    try {
      const res = await fetch("/api/contact-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id, title, existingWebsite }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "自動検索に失敗しました");

      const result = data.result;
      setRows((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          searching: false,
          saved: true,
          maker_website: result.officialUrl ?? prev[id].maker_website,
          maker_email: result.email ?? prev[id].maker_email,
          maker_instagram: result.instagram ?? prev[id].maker_instagram,
          maker_twitter: result.twitter ?? prev[id].maker_twitter,
          maker_facebook: result.facebook ?? prev[id].maker_facebook,
        },
      }));
    } catch (err) {
      setRows((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          searching: false,
          error: err instanceof Error ? err.message : "自動検索に失敗しました",
        },
      }));
    }
  }

  async function save(id: string) {
    const row = rows[id];
    if (!row) return;
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], saving: true, error: null } }));
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maker_website: row.maker_website.trim() || null,
          maker_email: row.maker_email.trim() || null,
          maker_contact_form: row.maker_contact_form.trim() || null,
          maker_instagram: row.maker_instagram.trim() || null,
          maker_twitter: row.maker_twitter.trim() || null,
          maker_facebook: row.maker_facebook.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      setRows((prev) => ({ ...prev, [id]: { ...prev[id], saving: false, saved: true } }));
    } catch (err) {
      setRows((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          saving: false,
          error: err instanceof Error ? err.message : "保存に失敗しました",
        },
      }));
    }
  }

  function skip(id: string) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], skipped: true } }));
  }

  const visible = projects.filter((p) => !rows[p.id]?.skipped);

  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">該当案件はありません。</p>;
  }

  if (visible.length === 0) {
    return <p className="text-sm text-emerald-400">全件スキップ済みです。</p>;
  }

  return (
    <div className="space-y-3">
      {visible.map((p) => {
        const row = rows[p.id];
        const platformLabel = PLATFORM_LABELS[p.platform] ?? p.platform;
        const hasSnsFound = row.maker_instagram || row.maker_twitter || row.maker_facebook;
        return (
          <div key={p.id} className="rounded-lg border border-border bg-background p-3">
            {/* ヘッダー行 */}
            <div className="flex items-start gap-2 mb-3">
              <span className="mt-0.5 shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {platformLabel}
              </span>
              <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-primary">
                {p.score}
              </span>
              <div className="min-w-0 flex-1">
                <a
                  href={p.original_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium hover:underline"
                >
                  {p.title.slice(0, 60)}
                </a>
                {hasSnsFound && <SnsLinks row={row} />}
                {!hasSnsFound && <SearchButtons title={p.title} />}
              </div>

              <div className="shrink-0 flex flex-col gap-1 items-end">
                {/* サイトを開くボタン（🟡エリアのみ） */}
                {showSiteButton && p.maker_website && (
                  <a
                    href={p.maker_website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-400 hover:bg-amber-500/20"
                  >
                    <ExternalLink className="h-3 w-3" />
                    サイトを開く
                  </a>
                )}
                {/* 自動検索ボタン */}
                <button
                  onClick={() => autoSearch(p.id, p.title, row.maker_website || p.maker_website)}
                  disabled={row.searching}
                  className="flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-2 py-1 text-[11px] text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  {row.searching ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Search className="h-3 w-3" />
                  )}
                  {row.searching ? "検索中..." : "自動検索"}
                </button>
              </div>
            </div>

            {/* 自動検索結果バナー */}
            {row.saved && row.maker_email && (
              <div className="mb-2 flex items-center gap-2 rounded bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-400">
                ✓ メール取得: {row.maker_email}
                {hasSnsFound && " · SNSリンクも取得済み"}
              </div>
            )}

            {/* 入力欄 */}
            <div className="grid gap-2 sm:grid-cols-2">
              {!showSiteButton && (
                <input
                  type="text"
                  value={row.maker_website}
                  onChange={(e) => updateField(p.id, "maker_website", e.target.value)}
                  placeholder="公式サイト URL"
                  className="rounded border border-border bg-secondary/30 px-2 py-1 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              )}
              <input
                type="text"
                value={row.maker_email}
                onChange={(e) => updateField(p.id, "maker_email", e.target.value)}
                placeholder="メールアドレス"
                className="rounded border border-border bg-secondary/30 px-2 py-1 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                type="text"
                value={row.maker_contact_form}
                onChange={(e) => updateField(p.id, "maker_contact_form", e.target.value)}
                placeholder="お問い合わせフォーム URL"
                className="rounded border border-border bg-secondary/30 px-2 py-1 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
              />

              {/* SNS入力欄 */}
              <div className="sm:col-span-2 grid gap-2 sm:grid-cols-3">
                <div className="flex items-center gap-1">
                  <Instagram className="h-3 w-3 shrink-0 text-pink-400" />
                  <input
                    type="text"
                    value={row.maker_instagram}
                    onChange={(e) => updateField(p.id, "maker_instagram", e.target.value)}
                    placeholder="Instagram URL"
                    className="flex-1 rounded border border-border bg-secondary/30 px-2 py-1 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Twitter className="h-3 w-3 shrink-0 text-sky-400" />
                  <input
                    type="text"
                    value={row.maker_twitter}
                    onChange={(e) => updateField(p.id, "maker_twitter", e.target.value)}
                    placeholder="X / Twitter URL"
                    className="flex-1 rounded border border-border bg-secondary/30 px-2 py-1 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-3 w-3 shrink-0 text-[10px] text-blue-400">fb</span>
                  <input
                    type="text"
                    value={row.maker_facebook}
                    onChange={(e) => updateField(p.id, "maker_facebook", e.target.value)}
                    placeholder="Facebook URL"
                    className="flex-1 rounded border border-border bg-secondary/30 px-2 py-1 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {/* 保存・スキップ */}
              <div className="sm:col-span-2 flex items-center gap-2">
                <button
                  onClick={() => save(p.id)}
                  disabled={row.saving}
                  className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {row.saving ? "保存中..." : row.saved ? "✓ 保存済" : "保存"}
                </button>
                <button
                  onClick={() => skip(p.id)}
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  スキップ
                </button>
                {row.error && <p className="text-xs text-red-400">{row.error}</p>}
              </div>
            </div>
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground">残り {visible.length} 件</p>
    </div>
  );
}
