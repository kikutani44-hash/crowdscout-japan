import type { PlatformFilterValue } from "@/lib/platforms";

export type Platform = "kickstarter" | "indiegogo" | "wadiz" | "zeczec";
export type ProjectStatus = "active" | "ended";
export type OfferStatus = "未接触" | "交渉中" | "獲得済み" | "却下";

export interface JapanCfSiteResult {
  site: "makuake" | "greenfunding" | "campfire";
  found: boolean;
  url: string;
  query: string;
  matches?: string[];
}

export interface JapanCfResult {
  checkedAt: string;
  query: string;
  sites: JapanCfSiteResult[];
  isJapanUnentered: boolean;
}

export interface Project {
  id: string;
  title: string;
  title_ja: string | null;
  subtitle: string | null;
  subtitle_ja: string | null;
  platform: Platform;
  original_url: string;
  image_url: string | null;
  raised_usd: number;
  goal_usd: number;
  backers: number;
  category: string;
  country: string | null;
  status: ProjectStatus;
  deadline_at: string | null;
  launched_at: string | null;
  days_remaining: number | null;
  backers_per_day: number;
  score: number;
  offer_status: OfferStatus;
  japan_cf_checked: boolean;
  japan_cf_result: JapanCfResult | null;
  pse_ok: boolean;
  giteki_ok: boolean;
  maker_email: string | null;
  maker_website: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFilters {
  search?: string;
  japanUnenteredOnly?: boolean;
  platform?: PlatformFilterValue;
  category?: string;
  offerStatus?: OfferStatus | "all";
  sortBy?: "score" | "raised_usd" | "backers" | "created_at" | "live_momentum";
  liveHotOnly?: boolean;
}

export interface DashboardStats {
  totalProjects: number;
  totalRaisedUsd: number;
  byOfferStatus: Record<OfferStatus, number>;
  byCategory: Record<string, number>;
}
