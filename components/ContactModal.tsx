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
import { Copy, Eye, FileText, Instagram, Loader2, Mail, MessageSquare, Send, Twitter } from "lucide-react";

type TabId = "email" | "sns" | "dm-log" | "japan-page";

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

interface SnsDmResult {
  platform: "instagram" | "twitter" | "facebook";
  text: string;
  lang: string;
  charCount: number;
  langInfo?: { code: string; label: string; nativeLabel: string };
}

interface JapanPageContent {
  catchcopy: string;
  intro: string;
  features: string[];
  targetDescription: string;
  faq: Array<{ q: string; a: string }>;
  callToAction: string;
}

interface DmLogEntry {
  id: string;
  platform: string;
  direction: "sent" | "received";
  text: string;
  date: string;
}

// ローカルストレージ DM ログ
function loadDmLog(projectId: string): DmLogEntry[] {
  try {
    const raw = localStorage.getItem(`dm_log_${projectId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDmLog(projectId: string, log: DmLogEntry[]) {
  localStorage.setItem(`dm_log_${projectId}`, JSON.stringify(log));
}

export function ContactModal({ project, open, onOpenChange, onSent }: ContactModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("email");

  // Email tab
  const [email, setEmail] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState<LetterPreview | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSendMessage, setEmailSendMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [emailFetching, setEmailFetching] = useState(false);
  const [emailType, setEmailType] = useState<"first" | "second">("first");

  // SNS DM tab
  const [snsPlatform, setSnsPlatform] = useState<"instagram" | "twitter">("instagram");
  const [snsDm, setSnsDm] = useState<SnsDmResult | null>(null);
  const [snsLoading, setSnsLoading] = useState(false);
  const [snsCopied, setSnsCopied] = useState(false);

  // Japan Page tab
  const [jpPlatform, setJpPlatform] = useState<"makuake" | "campfire" | "greenfunding">("makuake");
  const [jpContent, setJpContent] = useState<JapanPageContent | null>(null);
  const [jpLoading, setJpLoading] = useState(false);

  // DM Log tab
  const [dmLog, setDmLog] = useState<DmLogEntry[]>([]);
  const [dmInput, setDmInput] = useState("");
  const [dmDirection, setDmDirection] = useState<"sent" | "received">("received");
  const [dmPlatform, setDmPlatform] = useState("instagram");

  const loadPreview = useCallback(async () => {
    if (!project) return;
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/send-offer/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, customNote, emailType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data.letter);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "プレビュー取得に失敗しました" });
    } finally {
      setPreviewLoading(false);
    }
  }, [project, customNote]);


  const generateSnsDm = async () => {
    if (!project) return;
    setSnsLoading(true);
    setSnsDm(null);
    try {
      const res = await fetch("/api/sns-dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, platform: snsPlatform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSnsDm(data);
    } catch {
      // silently handle
    } finally {
      setSnsLoading(false);
    }
  };

  const generateJpPage = async () => {
    if (!project) return;
    setJpLoading(true);
    setJpContent(null);
    try {
      const res = await fetch("/api/japan-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, platform: jpPlatform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJpContent(data.content);
    } catch {
      // silently handle
    } finally {
      setJpLoading(false);
    }
  };

  const addDmLog = () => {
    if (!project || !dmInput.trim()) return;
    const entry: DmLogEntry = {
      id: Date.now().toString(),
      platform: dmPlatform,
      direction: dmDirection,
      text: dmInput.trim(),
      date: new Date().toISOString(),
    };
    const newLog = [...dmLog, entry];
    setDmLog(newLog);
    saveDmLog(project.id, newLog);
    setDmInput("");
  };

  const deleteDmLog = (id: string) => {
    if (!project) return;
    const newLog = dmLog.filter((e) => e.id !== id);
    setDmLog(newLog);
    saveDmLog(project.id, newLog);
  };

  const handleFetchEmail = async () => {
    if (!project) return;
    setEmailFetching(true);
    try {
      const res = await fetch("/api/contact-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          title: project.title,
          existingWebsite: project.maker_website ?? null,
        }),
      });
      const data = await res.json();
      if (data.result?.email) {
        setEmail(data.result.email);
      } else {
        alert("メールアドレスが見つかりませんでした");
      }
    } catch {
      alert("取得に失敗しました");
    } finally {
      setEmailFetching(false);
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

      setSnsDm(null);
      setJpContent(null);
      setActiveTab("email");
      setEmailType("first");
      setDmLog(loadDmLog(project.id));
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
          body: preview.text_translated ?? preview.text,
          projectTitle: getDisplayTitle(project),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "メール送信に失敗しました");
      setEmailSendMessage({ type: "success", text: "送信しました！" });
    } catch (err) {
      setEmailSendMessage({ type: "error", text: err instanceof Error ? err.message : "メール送信に失敗しました" });
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
        body: JSON.stringify({ projectId: project.id, to: email.trim(), customNote: customNote.trim() || undefined, emailType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "送信に失敗しました");
      setMessage({ type: "success", text: data.message });
      onSent?.(project.id, data.offer_status ?? "交渉中");
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "送信に失敗しました" });
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "email", label: "メール", icon: <Mail className="h-3.5 w-3.5" /> },
    { id: "sns", label: "SNS DM", icon: <Instagram className="h-3.5 w-3.5" /> },
    { id: "dm-log", label: "DM記録", icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { id: "japan-page", label: "日本ページ", icon: <FileText className="h-3.5 w-3.5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {getDisplayTitle(project).slice(0, 50)}
          </DialogTitle>
        </DialogHeader>

        {/* プロジェクト概要 */}
        <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            {project.platform} · 調達額 {formatUsd(project.raised_usd)} · 支援者 {project.backers.toLocaleString()}人 · スコア {project.score}
          </p>
          {matchesJapanUnenteredOnlyFilter(project) && (
            <Badge variant={getJapanCfBadgeVariant(getJapanCfDisplayStatus(project))} className="mt-1 text-[10px]">
              {getJapanCfBadgeLabel(getJapanCfDisplayStatus(project))}
            </Badge>
          )}
        </div>

        {/* タブ */}
        <div className="flex gap-1 rounded-lg border border-border bg-secondary/20 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition ${
                activeTab === tab.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── タブ: メール ─── */}
        {activeTab === "email" && (
          <div className="space-y-4">
            {/* 1通目 / 2通目 トグル */}
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => { setEmailType("first"); setShowPreview(false); setPreview(null); }}
                className={`flex-1 py-1.5 text-xs font-medium transition ${emailType === "first" ? "bg-primary text-primary-foreground" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60"}`}
              >
                1通目：フックメール
              </button>
              <button
                onClick={() => { setEmailType("second"); setShowPreview(false); setPreview(null); }}
                className={`flex-1 py-1.5 text-xs font-medium transition ${emailType === "second" ? "bg-primary text-primary-foreground" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60"}`}
              >
                2通目：提案書メール
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {emailType === "first"
                ? "🎣 日本市場への関心を引くフックメール。AIが商品に合わせてパーソナライズします。"
                : "📊 日本市場レポートを提示する具体的な提案メール。返信なしの場合3日後に送信。"}
            </p>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">送信先メール</label>
              <div className="flex gap-2">
                <Input type="email" placeholder="partner@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFetchEmail}
                  disabled={emailFetching}
                  title="公式サイトからメールアドレスを自動取得"
                  className="shrink-0"
                >
                  {emailFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {emailFetching ? "取得中" : "取得"}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">追加メッセージ（任意）</label>
              <textarea
                className="flex min-h-[72px] w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                onClick={() => window.open(`/report/${project.id}`, "_blank")}
                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              >
                <FileText className="h-4 w-4" />
                日本市場レポートを開く
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {emailType === "first" ? "✨ AIがこの商品に最適化したフックメールを生成します" : "📎 日本市場データを含む具体的な提案メールを生成します"}
            </p>

            {showPreview && preview && (
              <>
                <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-primary">Subject: {preview.subject}</p>
                    {preview.lang && (
                      <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] text-blue-400">
                        {preview.lang.label}（{preview.lang.nativeLabel}）
                      </span>
                    )}
                  </div>
                  {preview.text_translated && (
                    <div>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                        {preview.lang?.nativeLabel ?? "翻訳"}（送信文）
                      </p>
                      <pre className="whitespace-pre-wrap text-xs leading-relaxed">{preview.text_translated}</pre>
                    </div>
                  )}
                  <div className={preview.text_translated ? "border-t border-border pt-3" : ""}>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {preview.text_translated ? "English（原文）" : "English（送信文）"}
                    </p>
                    <pre className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{preview.text}</pre>
                  </div>
                  {preview.text_ja && (
                    <div className="border-t border-border pt-3">
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">日本語訳（参考）</p>
                      <pre className="whitespace-pre-wrap text-xs leading-relaxed">{preview.text_ja}</pre>
                    </div>
                  )}
                </div>
                <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-3">
                  <Input type="email" placeholder="partner@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <Button onClick={handleSendEmail} disabled={emailSending || !email.trim()} className="w-full">
                    <Send className="h-4 w-4" />
                    {emailSending ? "送信中..." : "メールを送信"}
                  </Button>
                  {emailSendMessage && (
                    <p className={`text-sm ${emailSendMessage.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                      {emailSendMessage.text}
                    </p>
                  )}
                </div>
              </>
            )}


            {message && (
              <p className={`text-sm ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                {message.text}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
              <Button onClick={handleSend} disabled={loading || !email.trim()}>
                <Send className="h-4 w-4" />
                {loading ? "送信中..." : "送信する"}
              </Button>
            </div>
          </div>
        )}

        {/* ─── タブ: SNS DM ─── */}
        {activeTab === "sns" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">プラットフォーム:</span>
              {(["instagram", "twitter"] as const).map((pl) => (
                <button
                  key={pl}
                  onClick={() => { setSnsPlatform(pl); setSnsDm(null); }}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                    snsPlatform === pl ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {pl === "instagram" ? <Instagram className="h-3 w-3" /> : <Twitter className="h-3 w-3" />}
                  {pl === "instagram" ? "Instagram DM" : "X (Twitter) DM"}
                </button>
              ))}
            </div>

            {/* SNS アカウント リンク */}
            {(project.maker_instagram || project.maker_twitter) && (
              <div className="rounded-lg border border-border bg-secondary/10 px-3 py-2 text-xs">
                <p className="text-muted-foreground mb-1">メーカーのSNSアカウント:</p>
                <div className="flex flex-wrap gap-2">
                  {project.maker_instagram && (
                    <a href={project.maker_instagram} target="_blank" rel="noreferrer" className="text-pink-400 hover:underline flex items-center gap-1">
                      <Instagram className="h-3 w-3" /> Instagram
                    </a>
                  )}
                  {project.maker_twitter && (
                    <a href={project.maker_twitter} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline flex items-center gap-1">
                      <Twitter className="h-3 w-3" /> X / Twitter
                    </a>
                  )}
                </div>
              </div>
            )}

            <Button onClick={generateSnsDm} disabled={snsLoading} className="w-full">
              {snsLoading ? <><Loader2 className="h-4 w-4 animate-spin" />生成中...</> : "DM文を自動生成"}
            </Button>

            {snsDm && (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {snsDm.charCount}文字
                        {snsPlatform === "twitter" && (
                          <span className={snsDm.charCount > 140 ? " text-red-400" : " text-emerald-400"}>
                            {snsDm.charCount > 140 ? " ⚠️超過" : " ✓"}
                          </span>
                        )}
                      </span>
                      {snsDm.langInfo && (
                        <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] text-blue-400">
                          {snsDm.langInfo.nativeLabel}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(snsDm.text);
                        setSnsCopied(true);
                        setTimeout(() => setSnsCopied(false), 2000);
                      }}
                      className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                      {snsCopied ? "コピー済み ✓" : "コピー"}
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed">{snsDm.text}</pre>
                </div>

                {(snsPlatform === "instagram" ? project.maker_instagram : project.maker_twitter) && (
                  <a
                    href={snsPlatform === "instagram" ? project.maker_instagram! : project.maker_twitter!}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full rounded-lg border border-pink-500/30 bg-pink-500/5 py-2 text-center text-sm text-pink-400 hover:bg-pink-500/10"
                  >
                    {snsPlatform === "instagram" ? "Instagram" : "X (Twitter)"}を開いてDMを送る →
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── タブ: DM記録 ─── */}
        {activeTab === "dm-log" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Instagram・XなどSNSでのやり取りを手動で記録できます。履歴はブラウザに保存されます。
            </p>

            {/* 入力欄 */}
            <div className="space-y-2 rounded-lg border border-border bg-secondary/10 p-3">
              <div className="flex gap-2">
                <select
                  value={dmPlatform}
                  onChange={(e) => setDmPlatform(e.target.value)}
                  className="rounded border border-border bg-background px-2 py-1 text-xs"
                >
                  <option value="instagram">Instagram</option>
                  <option value="twitter">X / Twitter</option>
                  <option value="email">メール</option>
                  <option value="other">その他</option>
                </select>
                <div className="flex gap-1">
                  {(["sent", "received"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDmDirection(d)}
                      className={`rounded px-2 py-1 text-xs transition ${
                        dmDirection === d ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {d === "sent" ? "📤 送信" : "📨 受信"}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="DMの内容を貼り付けてください..."
                value={dmInput}
                onChange={(e) => setDmInput(e.target.value)}
              />
              <Button size="sm" onClick={addDmLog} disabled={!dmInput.trim()}>
                記録する
              </Button>
            </div>

            {/* ログ一覧 */}
            {dmLog.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">まだ記録がありません</p>
            ) : (
              <div className="space-y-2">
                {[...dmLog].reverse().map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-lg border px-3 py-2 ${
                      entry.direction === "received"
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-border bg-secondary/10"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{entry.direction === "sent" ? "📤" : "📨"}</span>
                        <span className="capitalize">{entry.platform}</span>
                        <span>{new Date(entry.date).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <button onClick={() => deleteDmLog(entry.id)} className="text-[10px] text-muted-foreground hover:text-red-400">
                        削除
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed">{entry.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── タブ: 日本向けページ ─── */}
        {activeTab === "japan-page" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              海外クラファン商品を日本向けに紹介するページのテキストを自動生成します。
            </p>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">掲載先:</span>
              {(["makuake", "campfire", "greenfunding"] as const).map((pl) => (
                <button
                  key={pl}
                  onClick={() => setJpPlatform(pl)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    jpPlatform === pl ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {pl === "makuake" ? "Makuake" : pl === "campfire" ? "CAMPFIRE" : "Green Funding"}
                </button>
              ))}
            </div>

            <Button onClick={generateJpPage} disabled={jpLoading} className="w-full">
              {jpLoading ? <><Loader2 className="h-4 w-4 animate-spin" />生成中...</> : "日本向けページコンテンツを生成"}
            </Button>

            {jpContent && (
              <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">キャッチコピー</p>
                  <p className="text-lg font-bold text-primary">{jpContent.catchcopy}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">導入文</p>
                  <p className="text-sm leading-relaxed">{jpContent.intro}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">特徴</p>
                  <ul className="space-y-1">
                    {jpContent.features.map((f, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="text-primary shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">ターゲット</p>
                  <p className="text-sm">{jpContent.targetDescription}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">よくある質問</p>
                  <div className="space-y-2">
                    {jpContent.faq.map((item, i) => (
                      <div key={i} className="rounded-md bg-secondary/20 p-2">
                        <p className="text-xs font-medium">Q: {item.q}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">A: {item.a}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">CTA</p>
                  <p className="text-sm font-bold text-emerald-400">{jpContent.callToAction}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const text = `【キャッチコピー】\n${jpContent.catchcopy}\n\n【導入文】\n${jpContent.intro}\n\n【特徴】\n${jpContent.features.map((f) => `・${f}`).join("\n")}\n\n【ターゲット】\n${jpContent.targetDescription}\n\n【よくある質問】\n${jpContent.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}\n\n【CTA】\n${jpContent.callToAction}`;
                    navigator.clipboard.writeText(text);
                  }}
                >
                  <Copy className="h-4 w-4" />
                  全文コピー
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
