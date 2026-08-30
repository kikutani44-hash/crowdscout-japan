import type { ContactRouteResult } from "./contact-route";
import type { JapanPresenceResult } from "./japan-presence";
import type { PlatformFilterValue } from "@/lib/platforms";

export type Platform = "kickstarter" | "indiegogo" | "wadiz" | "zeczec";
export type ProjectStatus = "active" | "ended" | "archived";
export type OfferStatus = "未接触" | "ウォッチ中" | "交渉中" | "獲得済み" | "却下";

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
  /** 公式サイトの生存チェック結果（true=生存 / false=到達不可 / null=未チェック） */
  site_alive?: boolean | null;
  site_status_code?: number | null;
  site_checked_at?: string | null;
  /** 日本参入チェック（自動）の結果。'entered'=販売の形跡あり / 'clear'=形跡なし / 'unknown'=判定できず */
  japan_presence_verdict?: "entered" | "clear" | "unknown" | null;
  japan_presence_score?: number | null;
  japan_presence_result?: JapanPresenceResult | null;
  japan_presence_checked_at?: string | null;
  /** 公式サイトから見つけた連絡窓口（卸申込フォーム・問い合わせ等） */
  contact_routes?: ContactRouteResult | null;
  contact_routes_checked_at?: string | null;
  /** オファー送信に使った窓口のURL（フォーム送信は手作業のため記録する） */
  offer_sent_via?: string | null;
  /** 実際に送った本文。2通目で矛盾しないように保存する */
  offer_sent_text?: string | null;
  maker_contact_form: string | null;
  maker_instagram: string | null;
  maker_twitter: string | null;
  maker_facebook: string | null;
  maker_linkedin: string | null;
  offer_sent_at: string | null;
  offer_note: string | null;
  // チームコラボ
  assignee: string | null;
  negotiation_status: string | null;
  memo: string | null;
  followup_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFilters {
  search?: string;
  japanUnenteredOnly?: boolean;
  platform?: PlatformFilterValue;
  category?: string;
  offerStatus?: OfferStatus | "all";
  sortBy?: "score" | "raised_usd" | "backers" | "created_at" | "live_momentum" | "new_potential";
  newOnly?: boolean;
  liveHotOnly?: boolean;
  archivedOnly?: boolean;
}

export interface DashboardStats {
  totalProjects: number;
  totalRaisedUsd: number;
  byOfferStatus: Record<OfferStatus, number>;
  byCategory: Record<string, number>;
}
