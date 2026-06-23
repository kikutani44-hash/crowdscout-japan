"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
import {
  getJapanCfBadgeLabel,
  getJapanCfBadgeVariant,
  getJapanCfDisplayStatus,
} from "@/lib/japan-cf-status";
import {
  calcAchievementRate,
  formatJpy,
  formatUsd,
  usdToJpy,
} from "@/lib/utils";
import { ExternalLink, Globe, Languages, Mail, SearchCheck, Users } from "lucide-react";

interface ProductCardProps {
  project: Project;
  onTranslate: (project: Project) => void;
  onCfCheck: (project: Project) => void;
  onOffer: (project: Project) => void;
  onOfferStatusChange: (projectId: string, status: OfferStatus) => void;
  loadingAction?: string | null;
}

export function ProductCard({
  project,
  onTranslate,
  onCfCheck,
  onOffer,
  onOfferStatusChange,
  loadingAction,
}: ProductCardProps) {
  const achievement = calcAchievementRate(project.raised_usd, project.goal_usd);
  const japanCfStatus = getJapanCfDisplayStatus(project);
  const displayTitle = project.title_ja ?? project.title;
  const displaySubtitle = project.subtitle_ja ?? project.subtitle;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg transition hover:border-primary/40 hover:shadow-primary/10">
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary/40">
        {project.image_url ? (
          <Image
            src={project.image_url}
            alt={displayTitle}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No Image
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge variant="secondary" className="capitalize">
            {project.platform}
          </Badge>
          <Badge variant="outline" className="bg-background/80 text-xs">
            {formatCategoryLabel(project.category)}
          </Badge>
        </div>
        <div className="absolute right-3 top-3">
          <Badge className="bg-primary/90 text-base font-bold">{project.score}</Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-base font-bold leading-snug">{displayTitle}</h3>
          {project.title_ja && project.title_ja !== project.title ? (
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
        </div>

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
          <Button size="sm" onClick={() => onOffer(project)}>
            <Mail className="h-3.5 w-3.5" />
            オファー
          </Button>
        </div>

        <Link
          href={project.original_url}
          target="_blank"
          className="block text-center text-xs text-muted-foreground hover:text-primary"
        >
          元ページを見る →
        </Link>
      </div>
    </article>
  );
}
