"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";

interface RowState {
  maker_website: string;
  maker_email: string;
  maker_contact_form: string;
  saving: boolean;
  saved: boolean;
  error: string | null;
}

function initialRowState(p: Project): RowState {
  return {
    maker_website: p.maker_website ?? "",
    maker_email: p.maker_email ?? "",
    maker_contact_form: p.maker_contact_form ?? "",
    saving: false,
    saved: false,
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

export function UnconfirmedContactsTable({ projects }: { projects: Project[] }) {
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

  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        未確認の案件はありません。全プロジェクトでメーカー情報が確認済みです。
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 w-[260px]">案件名</th>
            <th className="py-2 pr-3">公式サイト</th>
            <th className="py-2 pr-3">メールアドレス</th>
            <th className="py-2 pr-3">お問い合わせフォーム</th>
            <th className="py-2 pr-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {projects.map((p) => {
            const row = rows[p.id];
            const platformLabel = PLATFORM_LABELS[p.platform] ?? p.platform;
            return (
              <tr key={p.id}>
                <td className="py-3 pr-3 align-top">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {platformLabel}
                    </span>
                    <div>
                      <a
                        href={p.original_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium hover:underline"
                      >
                        {p.title.slice(0, 45)}
                      </a>
                      <SearchButtons title={p.title} />
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-3 align-top">
                  <input
                    type="text"
                    value={row.maker_website}
                    onChange={(e) => updateField(p.id, "maker_website", e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                  />
                </td>
                <td className="py-3 pr-3 align-top">
                  <input
                    type="text"
                    value={row.maker_email}
                    onChange={(e) => updateField(p.id, "maker_email", e.target.value)}
                    placeholder="contact@example.com"
                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                  />
                </td>
                <td className="py-3 pr-3 align-top">
                  <input
                    type="text"
                    value={row.maker_contact_form}
                    onChange={(e) => updateField(p.id, "maker_contact_form", e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                  />
                </td>
                <td className="py-3 pr-3 align-top">
                  <button
                    onClick={() => save(p.id)}
                    disabled={row.saving}
                    className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {row.saving ? "保存中..." : "保存"}
                  </button>
                  {row.saved && <p className="mt-1 text-xs text-emerald-400">保存しました</p>}
                  {row.error && <p className="mt-1 text-xs text-red-400">{row.error}</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
