"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";
import { ContactModal } from "@/components/ContactModal";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/utils";
import { getDisplayTitle } from "@/lib/project-translation";
import { Mail, Clock, AlertTriangle } from "lucide-react";

const PLATFORM_LABELS: Record<string, string> = {
  kickstarter: "KS",
  indiegogo: "IGG",
  zeczec: "Zeczec",
  makuake: "Makuake",
};

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function FollowUpQueue({ projects }: { projects: Project[] }) {
  const [selected, setSelected] = useState<Project | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function openModal(p: Project) {
    setSelected(p);
    setModalOpen(true);
  }

  return (
    <>
      <div className="space-y-2">
        {projects.map((p) => {
          const days = daysSince(p.offer_sent_at);
          const needsFollowUp = days !== null && days >= 7;
          const urgent = days !== null && days >= 14;

          return (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                urgent
                  ? "border-red-500/30 bg-red-500/5"
                  : needsFollowUp
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-border bg-secondary/10"
              }`}
            >
              {/* 経過日数 */}
              <div className="w-14 shrink-0 text-center">
                {days !== null ? (
                  <>
                    <p className={`text-lg font-bold ${urgent ? "text-red-400" : needsFollowUp ? "text-amber-400" : "text-muted-foreground"}`}>
                      {days}日
                    </p>
                    <p className="text-[9px] text-muted-foreground">経過</p>
                  </>
                ) : (
                  <Clock className="mx-auto h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {/* プラットフォーム */}
              <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {PLATFORM_LABELS[p.platform] ?? p.platform}
              </span>

              {/* タイトル・メール */}
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
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {p.maker_email}
                    </span>
                  )}
                  {p.offer_sent_at && (
                    <span>
                      送信: {new Date(p.offer_sent_at).toLocaleDateString("ja-JP")}
                    </span>
                  )}
                </div>
              </div>

              {/* アクション */}
              <div className="shrink-0 space-y-1 text-right">
                {needsFollowUp && (
                  <p className={`flex items-center gap-1 text-[10px] ${urgent ? "text-red-400" : "text-amber-400"}`}>
                    <AlertTriangle className="h-3 w-3" />
                    {urgent ? "要フォローアップ" : "2通目を送る時期"}
                  </p>
                )}
                <Button
                  size="sm"
                  variant={needsFollowUp ? "default" : "outline"}
                  onClick={() => openModal(p)}
                >
                  2通目を送る
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <ContactModal
        project={selected}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
