"use client";

import { useState } from "react";
import { X, BarChart2, Users, DollarSign, AlertTriangle, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/types";

interface AnalysisResult {
  analysis: {
    targetAudience: string;
    priceRange: string;
    competitors: string;
    regulatoryRisk: string;
    timing: string;
    verdict: string;
  };
  pse: { required: boolean; note: string };
  giteki: { required: boolean; note: string };
}

interface Props {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VERDICT_COLORS: Record<string, string> = {
  "高ポテンシャル": "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  "中ポテンシャル": "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  "要検討": "text-red-400 bg-red-500/10 border-red-500/30",
};

export function MarketAnalysisModal({ project, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/market-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const verdictKey = result?.analysis.verdict?.split("（")[0] ?? "";
  const verdictColor = VERDICT_COLORS[verdictKey] ?? "text-blue-400 bg-blue-500/10 border-blue-500/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">日本市場分析</span>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="rounded-lg bg-secondary/30 px-3 py-2">
            <p className="text-sm font-medium truncate">{project.title_ja ?? project.title}</p>
            <p className="text-xs text-muted-foreground">{project.category} · ${project.raised_usd.toLocaleString()}</p>
          </div>

          {!result && !loading && (
            <div className="text-center py-6">
              <BarChart2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Claude AIが日本市場の観点から分析します</p>
              <Button onClick={handleAnalyze} className="w-full">
                <BarChart2 className="h-4 w-4" />
                市場分析を実行
              </Button>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">AIが分析中... (約10秒)</p>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/30 p-3">
              <p className="text-sm text-red-400">{error}</p>
              <Button size="sm" variant="outline" onClick={handleAnalyze} className="mt-2">再試行</Button>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* 総合評価 */}
              <div className={`rounded-lg border px-4 py-3 ${verdictColor}`}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1">総合評価</p>
                <p className="text-sm font-bold">{result.analysis.verdict}</p>
              </div>

              {/* ターゲット層 */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Users className="h-3.5 w-3.5" />ターゲット層
                </div>
                <p className="text-sm leading-relaxed">{result.analysis.targetAudience}</p>
              </div>

              {/* 価格帯 */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <DollarSign className="h-3.5 w-3.5" />日本での想定価格
                </div>
                <p className="text-sm leading-relaxed">{result.analysis.priceRange}</p>
              </div>

              {/* 競合 */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <BarChart2 className="h-3.5 w-3.5" />国内競合・類似製品
                </div>
                <p className="text-sm leading-relaxed">{result.analysis.competitors}</p>
              </div>

              {/* ローンチタイミング */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Clock className="h-3.5 w-3.5" />推奨ローンチ時期
                </div>
                <p className="text-sm leading-relaxed">{result.analysis.timing}</p>
              </div>

              {/* 規制リスク */}
              {result.analysis.regulatoryRisk && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <AlertTriangle className="h-3.5 w-3.5" />規制・輸入リスク
                  </div>
                  <p className="text-sm leading-relaxed">{result.analysis.regulatoryRisk}</p>
                </div>
              )}

              {/* PSE・技適 */}
              <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">認証要件（推定）</p>
                <div className="flex items-start gap-2">
                  {result.pse.required
                    ? <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    : <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />}
                  <div>
                    <p className="text-xs font-medium">PSE認証</p>
                    <p className="text-xs text-muted-foreground">{result.pse.note}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  {result.giteki.required
                    ? <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    : <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />}
                  <div>
                    <p className="text-xs font-medium">技適マーク</p>
                    <p className="text-xs text-muted-foreground">{result.giteki.note}</p>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleAnalyze}
                disabled={loading}
                className="w-full"
              >
                再分析する
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
