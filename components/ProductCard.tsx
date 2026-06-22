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
import type { OfferStatus, Project } from "@/lib/types";
import {
  calcAchievementRate,
  formatJpy,
  formatUsd,
  usdToJpy,
} from "@/lib/utils";
import { ExternalLink, Globe, Languages, Mail, SearchCheck } from "lucide-react";

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
  const isJapanUnentered = project.japan_cf_result?.isJapanUnentered;

  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-card shadow-lg transition hover:border-primary/40 hover:shadow-primary/10">
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary/40">
        {project.image_url ? (
          <Image
            src={project.image_url}
            alt={project.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No Image
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge variant="secondary" className="capitalize">
            {project.platform}
          </Badge>
        </div>
        <div className="absolute right-3 top-3">
          <Badge className="bg-primary/90 text-base font-bold">{project.score}</Badge>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-1 text-base font-semibold">
            {project.title_ja ?? project.title}
          </h3>
          <p className="line-clamp-1 text-xs text-muted-foreground">{project.title}</p>
        </div>

        <p className="line-clamp-2 text-sm text-muted-foreground">
          {project.subtitle_ja ?? project.subtitle}
        </p>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-primary">
              {formatJpy(usdToJpy(project.raised_usd))}
            </p>
            <p className="text-xs text-muted-foreground">{formatUsd(project.raised_usd)}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>達成率 {achievement}%</p>
            <p>支援者 {project.backers.toLocaleString()}人</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant={project.pse_ok ? "success" : "outline"}>
            PSE {project.pse_ok ? "OK" : "要確認"}
          </Badge>
          <Badge variant={project.giteki_ok ? "success" : "outline"}>
            技適 {project.giteki_ok ? "OK" : "要確認"}
          </Badge>
          {project.japan_cf_checked && (
            <Badge variant={isJapanUnentered ? "success" : "warning"}>
              {isJapanUnentered ? "🇯🇵 未参入" : "🇯🇵 発売済み"}
            </Badge>
          )}
        </div>

        {project.maker_website && (
          <a
            href={project.maker_website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Globe className="h-3 w-3" />
            メーカーサイト
            <ExternalLink className="h-3 w-3" />
          </a>
        )}

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

        <div className="grid grid-cols-3 gap-2">
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
