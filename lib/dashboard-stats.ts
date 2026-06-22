import type { OfferStatus, Project } from "./types";

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
    byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;
    byPlatform[p.platform] = (byPlatform[p.platform] ?? 0) + 1;
    if (p.japan_cf_result?.isJapanUnentered) japanUnenteredCount++;
    scoreSum += p.score;
  }

  const topByRaised = [...projects]
    .sort((a, b) => b.raised_usd - a.raised_usd)
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      title: p.title_ja ?? p.title,
      raisedUsd: p.raised_usd,
      platform: p.platform,
      score: p.score,
    }));

  const priorityOpportunities = [...projects]
    .filter((p) => p.japan_cf_result?.isJapanUnentered && p.offer_status !== "却下")
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      title: p.title_ja ?? p.title,
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
