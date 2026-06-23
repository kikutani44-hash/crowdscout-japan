import type { Project } from "./types";

/** Normalize for Japanese/English search (trim, unify full/half-width). */
export function normalizeSearchQuery(query: string): string {
  return query.trim().normalize("NFKC");
}

function sanitizeIlikeTerm(query: string): string {
  return normalizeSearchQuery(query)
    .replace(/,/g, " ")
    .replace(/[%_\\]/g, "");
}

const SEARCH_FIELDS = ["title", "title_ja", "subtitle", "subtitle_ja"] as const;

export function projectSearchHaystacks(
  project: Pick<Project, "title" | "title_ja" | "subtitle" | "subtitle_ja">
): string[] {
  return SEARCH_FIELDS.map((field) => project[field])
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeSearchQuery(value).toLowerCase());
}

export function projectMatchesSearch(
  project: Pick<Project, "title" | "title_ja" | "subtitle" | "subtitle_ja">,
  search: string
): boolean {
  const q = normalizeSearchQuery(search).toLowerCase();
  if (!q) return true;
  return projectSearchHaystacks(project).some((haystack) => haystack.includes(q));
}

/** PostgREST `.or()` filter for Supabase ilike search across EN/JA title & subtitle. */
export function buildSupabaseSearchOrFilter(search: string): string | null {
  const term = sanitizeIlikeTerm(search);
  if (!term) return null;
  return SEARCH_FIELDS.map((field) => `${field}.ilike.%${term}%`).join(",");
}
