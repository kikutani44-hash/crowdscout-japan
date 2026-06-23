import type { Project } from "./types";

/** Demo priority groups (Japanese). */
export const CATEGORY_GROUPS_JA = [
  "テクノロジー・ガジェット",
  "ヘルスケア・フィットネス",
  "アウトドア・スポーツ",
  "キッチン・家電",
  "モビリティ・乗り物",
  "ライフスタイル・デザイン",
] as const;

export type CategoryGroupJa = (typeof CATEGORY_GROUPS_JA)[number];

export interface CategoryOption {
  value: string;
  labelEn: string;
  labelJa: string;
  count: number;
}

/** Map platform category string → Japanese priority group. */
export function getCategoryGroupJa(category: string): CategoryGroupJa | "その他" {
  const lower = (category || "").toLowerCase();
  if (
    /technology|gadget|hardware|software|3d printing|robot|phone|camera equipment|maker|nas|scanner|keyboard|handheld|projector|ai |computer|device|electronic/.test(
      lower
    )
  ) {
    return "テクノロジー・ガジェット";
  }
  if (/health|fitness|medical|wellness|sport(?!s wear)/.test(lower)) {
    return "ヘルスケア・フィットネス";
  }
  if (/outdoor|camping|hike|travel bag|backpack|climb|mountain|fishing|swim|water park/.test(lower)) {
    return "アウトドア・スポーツ";
  }
  if (/kitchen|food|craft beer|cook|appliance|home|garden|brew|coffee|espresso/.test(lower)) {
    return "キッチン・家電";
  }
  if (/mobility|transport|vehicle|bike|ebike|scooter|flight|automotive|motor|wheel/.test(lower)) {
    return "モビリティ・乗り物";
  }
  if (/design|lifestyle|fashion|wearable|furniture|product|bag|instrument|music making|accessories/.test(lower)) {
    return "ライフスタイル・デザイン";
  }
  if (lower.includes("sport")) {
    return "アウトドア・スポーツ";
  }
  return "その他";
}

export function projectMatchesCategoryGroup(project: Pick<Project, "category">, group: string): boolean {
  if (group === "all") return true;
  return getCategoryGroupJa(project.category) === group;
}

export function buildCategoryOptions(projects: Pick<Project, "category">[]): CategoryOption[] {
  const counts = new Map<string, number>();
  for (const project of projects) {
    const group = getCategoryGroupJa(project.category);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }

  const ordered = [...CATEGORY_GROUPS_JA, "その他" as const].filter((group) => counts.has(group));

  return ordered.map((group) => ({
    value: group,
    labelEn: group,
    labelJa: group,
    count: counts.get(group) ?? 0,
  }));
}

export function formatCategoryLabel(category: string): string {
  return getCategoryGroupJa(category);
}
