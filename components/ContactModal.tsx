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
import {
  getJapanCfBadgeLabel,
  getJapanCfBadgeVariant,
  getJapanCfDisplayStatus,
  matchesJapanUnenteredOnlyFilter,
} from "@/lib/japan-cf-status";
import { formatUsd } from "@/lib/utils";
import { getDisplayTitle } from "@/lib/project-translation";
import { Eye, FileText, Mail, Send } from "lucide-react";

interface ContactModalProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: (projectId: string, offerStatus: OfferStatus) => void;
}

interface LetterPreview {
  subject: string;
  text: string;
  text_translated?: string | null;
  text_ja?: string;
  lang?: { code: string; label: string; nativeLabel: string };
}

interface MarketReport {
  html: string;
  text: string;
}

export function ContactModal({ project, open, onOpenChange, onSent }: ContactModalProps) {
  const [email, setEmail] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState<LetterPreview | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<MarketReport | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [emailSending, setEmailSending] = useState(false);
  const [emailSendMessage, setEmailSendMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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

  const generateReport = async () => {
    if (!project) return;
    setReportLoading(true);
    try {
      const res = await fetch("/api/market-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport({ html: data.html, text: data.text });
      setShowReport(true);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "レポート生成に失敗しました",
      });
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (open && project) {
      setEmail(project.maker_email ?? "");
      setCustomNote("");
      setMessage(null);
      setEmailSendMessage(null);
      setShowPreview(false);
      setPreview(null);
      setReport(null);
      setShowReport(false);
    }
  }, [open, project]);

  if (!project) return null;

  const handlePreview = async () => {
    setShowPreview(true);
    await loadPreview();
  };

  const handleSendEmail = async () => {
    if (!preview || !email.trim()) return;

    setEmailSending(true);
    setEmailSendMessage(null);
    try {
      const res = await fetch("/api/send-offer-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email.trim(),
          subject: preview.subject,
          body: preview.text,
          projectTitle: getDisplayTitle(project),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "メール送信に失敗しました");
      setEmailSendMessage({ type: "success", text: "送信しました！" });
    } catch (err) {
      setEmailSendMessage({
        type: "error",
        text: err instanceof Error ? err.message : "メール送信に失敗しました",
      });
    } finally {
      setEmailSending(false);
    }
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
            <p className="font-medium">{getDisplayTitle(project)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {project.platform} · 調達額 {formatUsd(project.raised_usd)} · 支援者{" "}
              {project.backers.toLocaleString()}人 · スコア {project.score}
            </p>
            {matchesJapanUnenteredOnlyFilter(project) && (
              <Badge
                variant={getJapanCfBadgeVariant(getJapanCfDisplayStatus(project))}
                className={
                  getJapanCfDisplayStatus(project) === "unchecked"
                    ? "mt-2 border-sky-500/40 text-sky-400"
                    : "mt-2"
                }
              >
                {getJapanCfBadgeLabel(getJapanCfDisplayStatus(project))}
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

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewLoading}>
              <Eye className="h-4 w-4" />
              {previewLoading ? "読込中..." : "メールプレビュー"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={generateReport}
              disabled={reportLoading}
              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
            >
              <FileText className="h-4 w-4" />
              {reportLoading ? "生成中..." : "日本市場レポート生成"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            1通目: フックメール（レポートを用意したと伝えて返信を引き出す）→ 2通目でレポートを添付
          </p>

          {showPreview && preview && (
            <>
              <div className="max-h-96 space-y-4 overflow-y-auto rounded-md border border-border bg-card p-4">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-primary">
                      Subject: {preview.subject}
                    </p>
                    {preview.lang && (
                      <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] text-blue-400">
                        送信言語: {preview.lang.label}（{preview.lang.nativeLabel}）
                      </span>
                    )}
                  </div>

                  {/* 翻訳文（英語以外のメーカー向け） */}
                  {preview.text_translated && (
                    <div className="mb-3">
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                        {preview.lang?.nativeLabel ?? "翻訳"}（送信文）
                      </p>
                      <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                        {preview.text_translated}
                      </pre>
                    </div>
                  )}

                  <div className={preview.text_translated ? "border-t border-border pt-3" : ""}>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {preview.text_translated ? "English（原文）" : "English（送信文）"}
                    </p>
                    <pre className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {preview.text}
                    </pre>
                  </div>
                </div>
                {preview.text_ja && (
                  <div className="border-t border-border pt-4">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      日本語訳（参考）
                    </p>
                    <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                      {preview.text_ja}
                    </pre>
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-md border border-border bg-secondary/20 p-4">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">宛先メールアドレス</label>
                  <Input
                    type="email"
                    placeholder="partner@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleSendEmail}
                  disabled={emailSending || !email.trim()}
                  className="w-full"
                >
                  <Send className="h-4 w-4" />
                  {emailSending ? "送信中..." : "メールを送信"}
                </Button>
                {emailSendMessage && (
                  <p
                    className={`text-sm ${
                      emailSendMessage.type === "success" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {emailSendMessage.text}
                  </p>
                )}
              </div>
            </>
          )}

          {showReport && report && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-blue-400">日本市場展開 提案書（プレビュー）</p>
                <a
                  href={`data:text/html;charset=utf-8,${encodeURIComponent(report.html)}`}
                  download="japan-market-report.html"
                  className="text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  HTMLダウンロード
                </a>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                  {report.text}
                </pre>
              </div>
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
