"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";
import { ContactModal } from "@/components/ContactModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/utils";
import { getDisplayTitle } from "@/lib/project-translation";
import { Mail, Globe, Send } from "lucide-react";

const PLATFORM_LABELS: Record<string, string> = {
  kickstarter: "KS",
  indiegogo: "IGG",
  zeczec: "Zeczec",
  makuake: "Makuake",
};

export function OutreachQueue({ projects }: { projects: Project[] }) {
  const [selected, setSelected] = useState<Project | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  function openModal(p: Project) {
    setSelected(p);
    setModalOpen(true);
  }

  function handleSent(projectId: string) {
    setSentIds((prev) => new Set(Array.from(prev).concat(projectId)));
    setModalOpen(false);
  }

  const visible = projects.filter((p) => !sentIds.has(p.id));

  if (visible.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        全件送信済みです。お疲れ様でした！
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {visible.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-secondary/10 px-4 py-3"
          >
            {/* スコア */}
            <div className="w-10 shrink-0 text-center">
              <p className="text-lg font-bold text-primary">{p.score}</p>
              <p className="text-[9px] text-muted-foreground">score</p>
            </div>

            {/* プラットフォーム */}
            <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {PLATFORM_LABELS[p.platform] ?? p.platform}
            </span>

            {/* タイトル・連絡先 */}
            <div className="min-w-0 flex-1">
              <a
                href={p.original_url}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-sm font-medium hover:underline"
              >
                {getDisplayTitle(p)}
              </a>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>{formatUsd(p.raised_usd)}</span>
                {p.maker_email && (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Mail className="h-3 w-3" />
                    {p.maker_email}
                  </span>
                )}
                {p.maker_contact_form && !p.maker_email && (
                  <a
                    href={p.maker_contact_form}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-sky-400 hover:underline"
                  >
                    <Globe className="h-3 w-3" />
                    フォーム
                  </a>
                )}
              </div>
            </div>

            {/* 送信ボタン */}
            <div className="shrink-0">
              {p.maker_email ? (
                <Button size="sm" onClick={() => openModal(p)}>
                  <Send className="h-3.5 w-3.5" />
                  送信
                </Button>
              ) : (
                <a href={p.maker_contact_form!} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline">
                    <Globe className="h-3.5 w-3.5" />
                    フォームを開く
                  </Button>
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <ContactModal
        project={selected}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSent={(id) => handleSent(id)}
      />
    </>
  );
}
