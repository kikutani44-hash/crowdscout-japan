"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { estimateJapanPrice, japanPriceVerdict } from "@/lib/japan-price";
import {
  japanPresenceBadgeClass,
  japanPresenceBadgeLabel,
  type JapanPresenceResult,
} from "@/lib/japan-presence";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCategoryLabel } from "@/lib/categories";
import type { OfferStatus, Project } from "@/lib/types";
import { TeamCollabPanel } from "@/components/TeamCollabPanel";
import { MarketAnalysisModal } from "@/components/MarketAnalysisModal";
import {
  getJapanCfBadgeLabel,
  getJapanCfBadgeVariant,
  getJapanCfDisplayStatus,
} from "@/lib/japan-cf-status";
import {
  formatBackersPerDay,
  formatDaysRemaining,
  formatEndDate,
  formatMonthsSinceEnd,
} from "@/lib/project-momentum";
import {
  calcAchievementRate,
  formatJpy,
  formatUsd,
  usdToJpy,
} from "@/lib/utils";
import {
  getDisplaySubtitle,
  getDisplayTitle,
  hasValidJapaneseTitle,
} from "@/lib/project-translation";
import { useState } from "react";
import { BarChart2, ExternalLink, Flame, Globe, Languages, Mail, MapPinned, SearchCheck, Timer, Users, Zap } from "lucide-react";
import { isHighPotential } from "@/lib/project-potential";

interface ProductCardProps {
  project: Project;
  onTranslate: (project: Project) => void;
  onCfCheck: (project: Project) => void;
  onOffer: (project: Project) => void;
  onOfferStatusChange: (projectId: string, status: OfferStatus) => void;
  onExternalLink?: (project: Project) => void;
  onCardClick?: (project: Project) => void;
  loadingAction?: string | null;
  isTranslating?: boolean;
}

export function ProductCard({
  project,
  onTranslate,
  onCfCheck,
  onOffer,
  onOfferStatusChange,
  onExternalLink,
  onCardClick,
  loadingAction,
  isTranslating,
}: ProductCardProps) {
  const [analysisOpen, setAnalysisOpen] = useState(false);
  // 日本参入チェックはカード内で完結させる（親に手を入れずに済むため）
  const [jpChecking, setJpChecking] = useState(false);
  const [jpLocal, setJpLocal] = useState<JapanPresenceResult | null>(null);

  const japanPresence = jpLocal ?? project.japan_presence_result ?? null;
  const japanPresenceVerdict = japanPresence?.verdict ?? project.japan_presence_verdict ?? null;

  async function runJapanPresenceCheck() {
    setJpChecking(true);
    try {
      const res = await fetch("/api/japan-presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          title: project.title,
          officialUrl: project.maker_website,
        }),
      });
      const data = (await res.json()) as JapanPresenceResult & { error?: string };
      if (!res.ok || data.error) {
        window.alert(`日本参入チェックに失敗しました: ${data.error ?? res.status}`);
        return;
      }
      setJpLocal(data);
    } catch (err) {
      window.alert(`日本参入チェックに失敗しました: ${err instanceof Error ? err.message : err}`);
    } finally {
      setJpChecking(false);
    }
  }
  const achievement = calcAchievementRate(project.raised_usd, project.goal_usd);
  const japanCfStatus = getJapanCfDisplayStatus(project);
  const displayTitle = getDisplayTitle(project);
  const displaySubtitle = getDisplaySubtitle(project);
  // 終了済み案件は「残り日数」ではなく「いつ終わったか」を見せる。
  // status はクロール次第で更新が遅れ、終了済みでも "active" のまま残ることが
  // あるため、status ではなく終了日そのもので判定する
  // （formatMonthsSinceEnd は終了日が未来なら null を返す）。
  const endedAgo = formatMonthsSinceEnd(project.deadline_at);
  // 日本での想定価格。AIを使わず計算で出しているのでクレジットは消費しない。
  const jpPrice = estimateJapanPrice(project.raised_usd, project.backers);
  const jpVerdict = japanPriceVerdict(jpPrice);
  const showEnglishTitle = hasValidJapaneseTitle(project) && displayTitle !== project.title;
  const isZeczec = project.platform === "zeczec";
  const imageSrc = project.image_url ?? null;

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg transition hover:border-primary/40 hover:shadow-primary/10"
      onClick={() => onCardClick?.(project)}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary/40">
        {imageSrc ? (
          isZeczec && !imageSrc.includes("supabase.co") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt={displayTitle}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <Image
              src={imageSrc}
              alt={displayTitle}
              fill
              className="object-cover transition duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm font-medium text-muted-foreground">
            No Image
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge variant="secondary" className="capitalize">
            {project.platform}
          </Badge>
          {project.status === "active" ? (
            <Badge className="border-orange-500/50 bg-orange-500/20 text-orange-200">
              <Flame className="mr-1 h-3 w-3" />
              進行中
            </Badge>
          ) : null}
          <Badge variant="outline" className="bg-background/80 text-xs">
            {formatCategoryLabel(project.category, project.title, project.subtitle ?? "")}
          </Badge>
        </div>
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
          {isHighPotential(project) && (
            <Badge className="border-yellow-400/50 bg-yellow-400/20 text-yellow-300">
              <Zap className="mr-1 h-3 w-3" />
              新着注目
            </Badge>
          )}
          <Badge className="bg-primary/90 text-base font-bold">{project.score}</Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-base font-bold leading-snug">
            {displayTitle}
            {isTranslating ? (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">翻訳中…</span>
            ) : null}
          </h3>
          {showEnglishTitle ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{project.title}</p>
          ) : null}
        </div>

        {displaySubtitle ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {displaySubtitle}
          </p>
        ) : null}

        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            調達額（日本円）
          </p>
          <p className="text-3xl font-extrabold tracking-tight text-primary">
            {formatJpy(usdToJpy(project.raised_usd))}
          </p>
          <p className="text-xs text-muted-foreground">{formatUsd(project.raised_usd)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-center">
            <p className="text-lg font-bold text-foreground">{achievement}%</p>
            <p className="text-[11px] text-muted-foreground">達成率</p>
          </div>
          <div className="rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-center">
            <p className="flex items-center justify-center gap-1 text-lg font-bold text-foreground">
              <Users className="h-4 w-4 text-muted-foreground" />
              {project.backers.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground">支援者数</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div
            className={`rounded-md border px-3 py-2 text-center ${
              project.status === "active" && (project.days_remaining ?? 999) <= 7
                ? "border-orange-500/40 bg-orange-500/10"
                : "border-border/60 bg-secondary/30"
            }`}
          >
            <p
              className="flex items-center justify-center gap-1 text-lg font-bold text-foreground"
              title={endedAgo ? `終了日: ${formatEndDate(project.deadline_at)}` : undefined}
            >
              <Timer className="h-4 w-4 text-muted-foreground" />
              {endedAgo ?? formatDaysRemaining(project.days_remaining, project.status)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {endedAgo ? "終了時期" : "残り日数"}
            </p>
          </div>
          <div
            className={`rounded-md border px-3 py-2 text-center ${
              project.status === "active" && (project.backers_per_day ?? 0) >= 10
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-border/60 bg-secondary/30"
            }`}
          >
            <p className="flex items-center justify-center gap-1 text-lg font-bold text-foreground">
              <Flame className="h-4 w-4 text-muted-foreground" />
              {formatBackersPerDay(project.backers_per_day)}
            </p>
            <p className="text-[11px] text-muted-foreground">勢い（支援者/日）</p>
          </div>
        </div>

        {jpPrice && (
          <div
            className={`rounded-md border px-3 py-2 ${
              jpVerdict?.level === "very-high"
                ? "border-red-500/40 bg-red-500/5"
                : jpVerdict?.level === "high"
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-emerald-500/30 bg-emerald-500/5"
            }`}
            title="海外CF価格の30〜50%で卸してもらえた場合に、送料・関税・認証・CF手数料・自社利益を乗せた日本での想定販売価格。卸掛率は交渉次第で動くため目安です。"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">日本CF 想定価格</span>
              <span className="text-sm font-bold text-foreground">{jpPrice.shortLabel}</span>
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              海外 {jpPrice.overseasLabel} → 卸値想定 {jpPrice.wholesaleLabel}
              {jpVerdict ? ` · ${jpVerdict.note}` : ""}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <Badge variant={project.pse_ok ? "success" : "outline"}>
            PSE {project.pse_ok ? "OK" : "要確認"}
          </Badge>
          <Badge variant={project.giteki_ok ? "success" : "outline"}>
            技適 {project.giteki_ok ? "OK" : "要確認"}
          </Badge>
          <Badge
            variant={getJapanCfBadgeVariant(japanCfStatus)}
            className={
              japanCfStatus === "unchecked"
                ? "border-sky-500/40 text-sky-400"
                : undefined
            }
          >
            {getJapanCfBadgeLabel(japanCfStatus)}
          </Badge>
          {japanPresenceVerdict ? (
            <Badge
              className={japanPresenceBadgeClass(japanPresenceVerdict)}
              title={japanPresence?.summary ?? undefined}
            >
              {japanPresenceBadgeLabel(japanPresenceVerdict)}
            </Badge>
          ) : null}
        </div>

        {/* 日本参入チェックで形跡が出た場合は、根拠をその場で見せる。
            判定を鵜呑みにせず、商品名を見て本人が確かめられるようにするため。 */}
        {japanPresenceVerdict === "entered" && japanPresence?.evidence?.length ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-xs">
            <p className="font-semibold text-red-200">日本での販売の形跡</p>
            <ul className="mt-1 space-y-0.5 text-red-100/80">
              {japanPresence.evidence.map((item, index) => (
                <li key={index}>
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-red-100"
                    >
                      {item.label}
                    </a>
                  ) : (
                    item.label
                  )}
                  {item.samples[0] ? (
                    <span className="block truncate text-red-100/60">
                      {item.samples[0]}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {project.maker_website ? (
          <a
            href={project.maker_website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-secondary/20 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-secondary/40"
          >
            <Globe className="h-3.5 w-3.5" />
            メーカーサイトを見る
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}

        <Select
          value={project.offer_status}
          onValueChange={(v) => onOfferStatusChange(project.id, v as OfferStatus)}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="未接触">未接触</SelectItem>
            <SelectItem value="ウォッチ中">👀 ウォッチ中</SelectItem>
            <SelectItem value="交渉中">交渉中</SelectItem>
            <SelectItem value="獲得済み">獲得済み</SelectItem>
            <SelectItem value="却下">却下</SelectItem>
          </SelectContent>
        </Select>

        <div className="mt-auto grid grid-cols-3 gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onTranslate(project)}
            disabled={loadingAction === `translate-${project.id}`}
          >
            <Languages className="h-3.5 w-3.5" />
            翻訳
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onCfCheck(project)}
            disabled={loadingAction === `cf-${project.id}`}
          >
            <SearchCheck className="h-3.5 w-3.5" />
            CF確認
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAnalysisOpen(true)}
            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            市場分析
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={runJapanPresenceCheck}
            disabled={jpChecking}
            className="border-red-500/30 text-red-300 hover:bg-red-500/10"
            title="ブランド名から日本向けドメイン・Amazon.co.jp・楽天・公式サイトの日本語対応を調べます"
          >
            <MapPinned className="h-3.5 w-3.5" />
            {jpChecking ? "調査中" : "日本参入"}
          </Button>
          <Button size="sm" onClick={() => onOffer(project)}>
            <Mail className="h-3.5 w-3.5" />
            オファー
          </Button>
        </div>

        <Link
          href={project.original_url}
          target="_blank"
          className="block text-center text-xs text-muted-foreground hover:text-primary"
          onClick={(e) => { e.stopPropagation(); onExternalLink?.(project); }}
        >
          元ページを見る →
        </Link>
      </div>

      <TeamCollabPanel project={project} />

      <MarketAnalysisModal
        project={project}
        open={analysisOpen}
        onOpenChange={setAnalysisOpen}
      />
    </article>
  );
}
