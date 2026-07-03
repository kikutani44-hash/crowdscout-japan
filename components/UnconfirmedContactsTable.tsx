"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";
import { ExternalLink } from "lucide-react";

interface RowState {
  maker_website: string;
  maker_email: string;
  maker_contact_form: string;
  saving: boolean;
  saved: boolean;
  skipped: boolean;
  error: string | null;
}

function initialRowState(p: Project): RowState {
  return {
    maker_website: p.maker_website ?? "",
    maker_email: p.maker_email ?? "",
    maker_contact_form: p.maker_contact_form ?? "",
    saving: false,
    saved: false,
    skipped: false,
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

  function updateField(id: string, field: "maker_website" | "maker_email" | "maker_contact_form", value: string) {
    setRows((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, saved: false, error: null },
    }));
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
    return (
      <p className="text-sm text-muted-foreground">該当案件はありません。</p>
    );
  }

  if (visible.length === 0) {
    return (
      <p className="text-sm text-emerald-400">全件スキップ済みです。</p>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((p) => {
        const row = rows[p.id];
        const platformLabel = PLATFORM_LABELS[p.platform] ?? p.platform;
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
                <SearchButtons title={p.title} />
              </div>
              {/* サイトを開くボタン（🟡エリアのみ） */}
              {showSiteButton && p.maker_website && (
                <a
                  href={p.maker_website}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-400 hover:bg-amber-500/20"
                >
                  <ExternalLink className="h-3 w-3" />
                  サイトを開く
                </a>
              )}
            </div>

            {/* 入力欄 */}
            <div className="grid gap-2 sm:grid-cols-3">
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

              {/* 保存・スキップ */}
              <div className="flex items-center gap-2">
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

      <p className="text-xs text-muted-foreground">
        残り {visible.length} 件
      </p>
    </div>
  );
}
