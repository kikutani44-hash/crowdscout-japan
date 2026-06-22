"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { OfferStatus, Project } from "@/lib/types";
import { formatUsd } from "@/lib/utils";
import { Eye, Mail, Send } from "lucide-react";

interface ContactModalProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: (projectId: string, offerStatus: OfferStatus) => void;
}

interface LetterPreview {
  subject: string;
  text: string;
}

export function ContactModal({ project, open, onOpenChange, onSent }: ContactModalProps) {
  const [email, setEmail] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState<LetterPreview | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const loadPreview = useCallback(async () => {
    if (!project) return;
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/send-offer/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, customNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data.letter);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "プレビュー取得に失敗しました",
      });
    } finally {
      setPreviewLoading(false);
    }
  }, [project, customNote]);

  useEffect(() => {
    if (open && project) {
      setEmail(project.maker_email ?? "");
      setCustomNote("");
      setMessage(null);
      setShowPreview(false);
      setPreview(null);
    }
  }, [open, project]);

  if (!project) return null;

  const handlePreview = async () => {
    setShowPreview(true);
    await loadPreview();
  };

  const handleSend = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/send-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          to: email.trim(),
          customNote: customNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "送信に失敗しました");
      setMessage({ type: "success", text: data.message });
      onSent?.(project.id, data.offer_status ?? "交渉中");
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "送信に失敗しました",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            オファーレター送信
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-secondary/20 p-4">
            <p className="font-medium">{project.title_ja ?? project.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {project.platform} · 調達額 {formatUsd(project.raised_usd)} · 支援者{" "}
              {project.backers.toLocaleString()}人 · スコア {project.score}
            </p>
            {project.japan_cf_result?.isJapanUnentered && (
              <Badge variant="success" className="mt-2">
                🇯🇵 日本未参入
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">送信先メール *</label>
            <Input
              type="email"
              placeholder="partner@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">追加メッセージ（任意）</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="例: We are interested in an exclusive partnership for Q4 2026 launch in Japan."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewLoading}>
              <Eye className="h-4 w-4" />
              {previewLoading ? "読込中..." : "プレビュー"}
            </Button>
            <p className="self-center text-xs text-muted-foreground">
              SendGrid 経由で英文オファーレターを送信します
            </p>
          </div>

          {showPreview && preview && (
            <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-card p-4">
              <p className="mb-2 text-xs font-semibold text-primary">Subject: {preview.subject}</p>
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {preview.text}
              </pre>
            </div>
          )}

          {message && (
            <p
              className={`text-sm ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}
            >
              {message.text}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSend} disabled={loading || !email.trim()}>
              <Send className="h-4 w-4" />
              {loading ? "送信中..." : "送信する"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
