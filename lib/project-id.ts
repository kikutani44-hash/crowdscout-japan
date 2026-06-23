import type { Platform, Project } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stable client id derived from platform + URL (matches project-store slug). */
export function slugId(originalUrl: string, platform: string): string {
  const slug = originalUrl.split("/").filter(Boolean).slice(-2).join("-");
  return `${platform}-${slug}`.slice(0, 80);
}

export function isUuid(id: string): boolean {
  return UUID_RE.test(id);
}

/** Parse kickstarter-foo-bar style ids into platform + URL path suffix. */
export function parseSlugProjectId(
  projectId: string
): { platform: Platform; pathSuffix: string } | null {
  const match = projectId.match(/^(kickstarter|indiegogo)-(.+)$/i);
  if (!match) return null;

  const platform = match[1].toLowerCase() as Platform;
  const parts = match[2].split("-");
  if (parts.length < 2) return null;

  const seg1 = parts[parts.length - 2];
  const seg2 = parts[parts.length - 1];
  return { platform, pathSuffix: `/${seg1}/${seg2}` };
}

export function projectMatchesClientId(project: Project, projectId: string): boolean {
  if (project.id === projectId) return true;
  return slugId(project.original_url, project.platform) === projectId;
}

/** Resolve a client-facing id (UUID or kickstarter-* slug) to a Supabase row. */
export async function findProjectByClientId(
  supabase: SupabaseClient,
  projectId: string
): Promise<Project | null> {
  if (isUuid(projectId)) {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();
    if (error) throw error;
    return (data as Project | null) ?? null;
  }

  const parsed = parseSlugProjectId(projectId);
  if (parsed) {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("platform", parsed.platform)
      .ilike("original_url", `%${parsed.pathSuffix}`)
      .limit(5);
    if (error) throw error;
    const rows = (data ?? []) as Project[];
    const exact = rows.find((row) => projectMatchesClientId(row, projectId));
    if (exact) return exact;
    if (rows.length === 1) return rows[0];
  }

  return null;
}

/** Keep the id the client sent so React state updates match. */
export function withClientProjectId(project: Project, clientId: string): Project {
  return { ...project, id: clientId };
}
