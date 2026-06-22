import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { loadLocalProjects } from "./project-store";
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
  platform?: string;
  category?: string;
  offerStatus?: string;
  sortBy?: string;
}): Promise<Project[]> {
  if (!isSupabaseConfigured()) {
    const projects = await loadLocalProjects();
    return filterSampleProjects(projects, filters);
  }

  const supabase = createServerSupabase();
  let query = supabase.from("projects").select("*");

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
    query = query.eq("japan_cf_checked", true).eq("japan_cf_result->>isJapanUnentered", "true");
  }
  if (filters?.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,title_ja.ilike.%${filters.search}%,subtitle.ilike.%${filters.search}%`
    );
  }

  const sortBy = filters?.sortBy ?? "score";
  query = query.order(sortBy, { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Project[];
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
  }
): Project[] {
  let result = [...projects];

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.title_ja?.toLowerCase().includes(q) ?? false) ||
        (p.subtitle?.toLowerCase().includes(q) ?? false)
    );
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
    result = result.filter((p) => p.japan_cf_result?.isJapanUnentered === true);
  }

  const sortBy = filters?.sortBy ?? "score";
  result.sort((a, b) => {
    const av = a[sortBy as keyof Project];
    const bv = b[sortBy as keyof Project];
    if (typeof av === "number" && typeof bv === "number") return bv - av;
    return String(bv ?? "").localeCompare(String(av ?? ""));
  });

  return result;
}
