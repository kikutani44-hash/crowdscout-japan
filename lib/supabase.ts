import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { buildSupabaseSearchOrFilter, projectMatchesSearch } from "./project-search";
import {
  buildSupabaseJapanUnenteredOrFilter,
  matchesJapanUnenteredOnlyFilter,
} from "./japan-cf-status";
import { loadLocalProjects } from "./project-store";
import {
  compareProjectsByLiveMomentum,
  matchesLiveHotFilter,
} from "./project-momentum";
import type { Project } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function createBrowserSupabase(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey);
}

export function createServerSupabase(): SupabaseClient {
  const key = supabaseServiceKey || supabaseAnonKey;
  return createClient(supabaseUrl, key);
}

export async function fetchProjects(filters?: {
  search?: string;
  japanUnenteredOnly?: boolean;
  archivedOnly?: boolean;
  /** 過去案件(archived)も含めて取得する。パイプラインなど横断的な一覧で使う */
  includeArchived?: boolean;
  platform?: string;
  category?: string;
  offerStatus?: string;
  sortBy?: string;
  liveHotOnly?: boolean;
}): Promise<Project[]> {
  if (!isSupabaseConfigured()) {
    const projects = await loadLocalProjects();
    return filterSampleProjects(projects, filters);
  }

  const supabase = createServerSupabase();
  let query = supabase.from("projects").select("*").limit(5000);

  // 進行中と終了済みの振り分けは status ではなく「終了日」で行う。
  // status はクロールでしか更新されず、終了済みでも "active" のまま
  // 残るため、トップページに終了案件が居座っていた（実測で786件中444件）。
  const nowIso = new Date().toISOString();
  if (filters?.archivedOnly) {
    // 過去案件ページ: 終了日を過ぎたもの、または明示的にarchived
    query = query.or(`status.eq.archived,deadline_at.lt.${nowIso}`);
  } else if (!filters?.includeArchived) {
    // トップページ: 実施中のみ。終了日が未設定の案件は判定できないので残す
    query = query
      .neq("status", "archived")
      .or(`deadline_at.gte.${nowIso},deadline_at.is.null`);
  }

  if (filters?.platform && filters.platform !== "all") {
    query = query.eq("platform", filters.platform);
  }
  if (filters?.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }
  if (filters?.offerStatus && filters.offerStatus !== "all") {
    query = query.eq("offer_status", filters.offerStatus);
  }
  if (filters?.japanUnenteredOnly) {
    query = query.or(buildSupabaseJapanUnenteredOrFilter());
  }
  if (filters?.search) {
    const orFilter = buildSupabaseSearchOrFilter(filters.search);
    if (orFilter) {
      query = query.or(orFilter);
    }
  }

  const sortBy = filters?.sortBy ?? "live_momentum";
  if (sortBy !== "live_momentum") {
    query = query.order(sortBy, { ascending: false });
  } else {
    query = query
      .order("status", { ascending: true })
      .order("days_remaining", { ascending: true, nullsFirst: false })
      .order("backers_per_day", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  let projects = (data ?? []) as Project[];
  if (filters?.liveHotOnly) {
    projects = projects.filter((p) => matchesLiveHotFilter(p, true));
  }
  if (sortBy === "live_momentum") {
    projects.sort(compareProjectsByLiveMomentum);
  }
  return projects;
}

function filterSampleProjects(
  projects: Project[],
  filters?: {
    search?: string;
    japanUnenteredOnly?: boolean;
    platform?: string;
    category?: string;
    offerStatus?: string;
    sortBy?: string;
    liveHotOnly?: boolean;
  }
): Project[] {
  let result = [...projects];

  if (filters?.search) {
    result = result.filter((p) => projectMatchesSearch(p, filters.search!));
  }
  if (filters?.platform && filters.platform !== "all") {
    result = result.filter((p) => p.platform === filters.platform);
  }
  if (filters?.category && filters.category !== "all") {
    result = result.filter((p) => p.category === filters.category);
  }
  if (filters?.offerStatus && filters.offerStatus !== "all") {
    result = result.filter((p) => p.offer_status === filters.offerStatus);
  }
  if (filters?.japanUnenteredOnly) {
    result = result.filter(matchesJapanUnenteredOnlyFilter);
  }
  if (filters?.liveHotOnly) {
    result = result.filter((p) => matchesLiveHotFilter(p, true));
  }

  const sortBy = filters?.sortBy ?? "live_momentum";
  if (sortBy === "live_momentum") {
    result.sort(compareProjectsByLiveMomentum);
  } else {
    result.sort((a, b) => {
      const av = a[sortBy as keyof Project];
      const bv = b[sortBy as keyof Project];
      if (typeof av === "number" && typeof bv === "number") return bv - av;
      return String(bv ?? "").localeCompare(String(av ?? ""));
    });
  }

  return result;
}
