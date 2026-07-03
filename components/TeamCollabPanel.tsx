"use client";

import { useState } from "react";
import { Users, FileText, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Project } from "@/lib/types";

const NEGOTIATION_STATUSES = [
  "未接触",
  "初回連絡済",
  "返信あり",
  "条件交渉中",
  "契約締結",
  "見送り",
] as const;

const TEAM_MEMBERS = [
  "菊谷佳孝",
  "スタッフA",
  "スタッフB",
  "スタッフC",
];

const STATUS_COLORS: Record<string, string> = {
  "未接触": "bg-gray-500/20 text-gray-400",
  "初回連絡済": "bg-blue-500/20 text-blue-400",
  "返信あり": "bg-emerald-500/20 text-emerald-400",
  "条件交渉中": "bg-yellow-500/20 text-yellow-400",
  "契約締結": "bg-purple-500/20 text-purple-400",
  "見送り": "bg-red-500/20 text-red-400",
};

interface Props {
  project: Project;
  onUpdate?: (updated: Partial<Project>) => void;
}

export function TeamCollabPanel({ project, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignee, setAssignee] = useState(project.assignee ?? "");
  const [negotiationStatus, setNegotiationStatus] = useState(
    project.negotiation_status ?? "未接触"
  );
  const [memo, setMemo] = useState(project.memo ?? "");
  const [followupAt, setFollowupAt] = useState(
    project.followup_at ? project.followup_at.slice(0, 10) : ""
  );
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        assignee: assignee || null,
        negotiation_status: negotiationStatus,
        memo: memo || null,
        followup_at: followupAt ? new Date(followupAt).toISOString() : null,
      };
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      onUpdate?.(body);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const currentStatusColor = STATUS_COLORS[negotiationStatus] ?? "bg-gray-500/20 text-gray-400";

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition"
      >
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5" />
          <span>チーム管理</span>
          {project.assignee && (
            <span className="text-foreground font-medium">— {project.assignee}</span>
          )}
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${currentStatusColor}`}>
            {negotiationStatus}
          </span>
          {project.followup_at && (
            <span className="text-yellow-400">
              📅 {new Date(project.followup_at).toLocaleDateString("ja-JP")}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <div className="space-y-3 px-3 pb-3">
          {/* 担当者 */}
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="flex-1 rounded-md border border-border bg-secondary/50 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">担当者未割り当て</option>
              {TEAM_MEMBERS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* 交渉ステータス */}
          <div>
            <p className="mb-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">交渉ステータス</p>
            <div className="flex flex-wrap gap-1.5">
              {NEGOTIATION_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setNegotiationStatus(s)}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                    negotiationStatus === s
                      ? STATUS_COLORS[s] + " ring-1 ring-current"
                      : "bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* フォローアップ日 */}
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              type="date"
              value={followupAt}
              onChange={(e) => setFollowupAt(e.target.value)}
              className="h-7 text-xs"
            />
            {followupAt && (
              <button onClick={() => setFollowupAt("")} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
            )}
          </div>

          {/* 交渉メモ */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">交渉メモ</span>
            </div>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="交渉の経緯・メモをここに記入..."
              rows={3}
              className="w-full rounded-md border border-border bg-secondary/50 px-2 py-1.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="w-full h-7 text-xs"
          >
            {saving ? "保存中..." : saved ? "✓ 保存しました" : "保存"}
          </Button>
        </div>
      )}
    </div>
  );
}
