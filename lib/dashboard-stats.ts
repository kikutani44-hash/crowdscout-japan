import type { OfferStatus, Project } from "./types";
import { getCategoryGroupJa } from "./categories";
import { countJapanUnenteredCandidates, matchesJapanUnenteredOnlyFilter } from "./japan-cf-status";
import { getDisplayTitle } from "./project-translation";

export interface DashboardStats {
  totalProjects: number;
  totalRaisedUsd: number;
  japanUnenteredCount: number;
  avgScore: number;
  byOfferStatus: Record<OfferStatus, number>;
  byCategory: Record<string, number>;
  byPlatform: Record<string, number>;
  topByRaised: Array<{
    id: string;
    title: string;
    raisedUsd: number;
    platform: string;
    score: number;
  }>;
  priorityOpportunities: Array<{
    id: string;
    title: string;
    score: number;
    raisedUsd: number;
    offerStatus: OfferStatus;
  }>;
}

export function getDashboardStats(projects: Project[]): DashboardStats {
  const byOfferStatus: Record<OfferStatus, number> = {
    未接触: 0,
    交渉中: 0,
    獲得済み: 0,
    却下: 0,
  };
  const byCategory: Record<string, number> = {};
  const byPlatform: Record<string, number> = {};

  let japanUnenteredCount = 0;
  let scoreSum = 0;

  for (const p of projects) {
    byOfferStatus[p.offer_status]++;
    const group = getCategoryGroupJa(p.category, p.title, p.subtitle ?? "");
    byCategory[group] = (byCategory[group] ?? 0) + 1;
    byPlatform[p.platform] = (byPlatform[p.platform] ?? 0) + 1;
    scoreSum += p.score;
  }

  japanUnenteredCount = countJapanUnenteredCandidates(projects);

  const topByRaised = [...projects]
    .sort((a, b) => b.raised_usd - a.raised_usd)
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      title: getDisplayTitle(p),
      raisedUsd: p.raised_usd,
      platform: p.platform,
      score: p.score,
    }));

  const priorityOpportunities = [...projects]
    .filter((p) => matchesJapanUnenteredOnlyFilter(p) && p.offer_status !== "却下")
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      title: getDisplayTitle(p),
      score: p.score,
      raisedUsd: p.raised_usd,
      offerStatus: p.offer_status,
    }));

  return {
    totalProjects: projects.length,
    totalRaisedUsd: projects.reduce((sum, p) => sum + p.raised_usd, 0),
    japanUnenteredCount,
    avgScore: projects.length ? Math.round(scoreSum / projects.length) : 0,
    byOfferStatus,
    byCategory,
    byPlatform,
    topByRaised,
    priorityOpportunities,
  };
}
