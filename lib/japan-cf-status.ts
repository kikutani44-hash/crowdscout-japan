import type { Project } from "./types";

type JapanCfProject = Pick<Project, "japan_cf_checked" | "japan_cf_result">;

export type JapanCfDisplayStatus = "unchecked" | "unentered" | "entered";

/** Checked on JP CF sites and found listed in Japan. */
export function isJapanCfEntered(project: JapanCfProject): boolean {
  return Boolean(
    project.japan_cf_checked &&
      project.japan_cf_result &&
      project.japan_cf_result.isJapanUnentered === false
  );
}

/** Matches 「日本未参入のみ表示」: unchecked, possibly unentered, or confirmed unentered. */
export function matchesJapanUnenteredOnlyFilter(project: JapanCfProject): boolean {
  return !isJapanCfEntered(project);
}

export function getJapanCfDisplayStatus(project: JapanCfProject): JapanCfDisplayStatus {
  if (!project.japan_cf_checked || !project.japan_cf_result) {
    return "unchecked";
  }
  return project.japan_cf_result.isJapanUnentered ? "unentered" : "entered";
}

export function getJapanCfBadgeLabel(status: JapanCfDisplayStatus): string {
  switch (status) {
    case "unchecked":
      return "🇯🇵 未参入の可能性あり";
    case "unentered":
      return "🇯🇵 未参入";
    case "entered":
      return "🇯🇵 発売済み";
  }
}

export function getJapanCfBadgeVariant(
  status: JapanCfDisplayStatus
): "success" | "warning" | "outline" {
  switch (status) {
    case "unchecked":
      return "outline";
    case "unentered":
      return "success";
    case "entered":
      return "warning";
  }
}

export function countJapanUnenteredCandidates(projects: JapanCfProject[]): number {
  return projects.filter(matchesJapanUnenteredOnlyFilter).length;
}

/** PostgREST `.or()` filter: exclude checked-and-entered projects only. */
export function buildSupabaseJapanUnenteredOrFilter(): string {
  return [
    "japan_cf_checked.eq.false",
    "japan_cf_result.is.null",
    "japan_cf_result->>isJapanUnentered.eq.true",
  ].join(",");
}
