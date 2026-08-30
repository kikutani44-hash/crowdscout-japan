"use client";

import { useState } from "react";
import type { OfferStatus, Project } from "@/lib/types";
import { ContactModal } from "@/components/ContactModal";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/utils";
import { getDisplayTitle } from "@/lib/project-translation";
import { AlertTriangle, CheckCircle, Clock, Mail, XCircle } from "lucide-react";
import { judgeFollowUp, followUpStageClass, followUpBadgeClass } from "@/lib/followup";

const PLATFORM_LABELS: Record<string, string> = {
  kickstarter: "KS",
  indiegogo: "IGG",
  zeczec: "Zeczec",
  makuake: "Makuake",
  wadiz: "Wadiz",
};

const STATUS_OPTIONS: { value: OfferStatus; label: string; color: string }[] = [
  { value: "交渉中", label: "交渉中", color: "text-blue-400" },
  { value: "獲得済み", label: "獲得済み ✓", color: "text-emerald-400" },
  { value: "却下", label: "却下", color: "text-red-400" },
  { value: "未接触", label: "未接触に戻す", color: "text-muted-foreground" },
];



interface RowState {
  note: string;
  status: OfferStatus;
  saving: boolean;
  saved: boolean;
}

export function FollowUpQueue({ projects }: { projects: Project[] }) {
  const [selected, setSelected] = useState<Project | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      projects.map((p) => [
        p.id,
        { note: p.offer_note ?? "", status: p.offer_status, saving: false, saved: false },
      ])
    )
  );

  function updateRow(id: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch, saved: false } }));
  }

  async function saveRow(id: string) {
    const row = rows[id];
    if (!row) return;
    updateRow(id, { saving: true });
    try {
      await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_note: row.note, offer_status: row.status }),
      });
      updateRow(id, { saving: false, saved: true });
    } catch {
      updateRow(id, { saving: false });
    }
  }

  return (
    <>
      <div className="space-y-3">
        {projects.map((p) => {
          // 相手が示した期限ではなく、営業日ベースの段階でこちらの行動を切り替える
          const followUp = judgeFollowUp(p.offer_sent_at);
          const row = rows[p.id];

          return (
            <div
              key={p.id}
              className={`rounded-lg border px-4 py-3 ${
                followUp ? followUpStageClass(followUp.stage) : "border-border bg-secondary/10"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* 経過（営業日）。土日を除いて数える */}
                <div className="w-16 shrink-0 text-center pt-1">
                  {followUp ? (
                    <>
                      <p className={`text-lg font-bold ${followUpBadgeClass(followUp.stage)}`}>
                        {followUp.businessDays}
                      </p>
                      <p className="text-[9px] text-muted-foreground">営業日</p>
                      <p className="text-[9px] text-muted-foreground">
                        （{followUp.calendarDays}日）
                      </p>
                    </>
                  ) : (
                    <Clock className="mx-auto h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* プラットフォーム */}
                <span className="mt-1 shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {PLATFORM_LABELS[p.platform] ?? p.platform}
                </span>

                {/* メイン情報 */}
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
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
                        <span>送信: {new Date(p.offer_sent_at).toLocaleDateString("ja-JP")}</span>
                      )}
                    </div>
                  </div>

                  {/* 交渉メモ */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={row?.note ?? ""}
                      onChange={(e) => updateRow(p.id, { note: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && saveRow(p.id)}
                      placeholder="交渉メモ（返信内容・進捗など）"
                      className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onClick={() => saveRow(p.id)}
                      disabled={row?.saving}
                      className="shrink-0 rounded bg-secondary px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {row?.saved ? "✓" : row?.saving ? "…" : "保存"}
                    </button>
                  </div>

                  {/* ステータス変更 */}
                  <div className="flex flex-wrap gap-1">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { updateRow(p.id, { status: opt.value }); setTimeout(() => saveRow(p.id), 50); }}
                        className={`rounded px-2 py-0.5 text-[10px] border transition ${
                          row?.status === opt.value
                            ? "border-current bg-current/10 " + opt.color
                            : "border-border text-muted-foreground hover:border-current hover:" + opt.color
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2通目ボタン */}
                <div className="shrink-0 space-y-1 text-right">
                  {followUp && followUp.stage !== "waiting" && (
                    <p
                      className={`flex items-center gap-1 text-[10px] ${followUpBadgeClass(followUp.stage)}`}
                      title={followUp.action}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {followUp.label}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant={followUp && followUp.stage !== "waiting" ? "default" : "outline"}
                    onClick={() => { setSelected(p); setModalOpen(true); }}
                  >
                    2通目を送る
                  </Button>
                </div>
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
