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

/** Map category + title → Japanese priority group. */
export function getCategoryGroupJa(
  category: string,
  title = "",
  subtitle = ""
): CategoryGroupJa | "その他" {
  const blob = `${category} ${title} ${subtitle}`.toLowerCase();
  if (/health|fitness|medical|wellness|sleep|massage|tracker|vitals|wearable/.test(blob)) {
    return "ヘルスケア・フィットネス";
  }
  if (/outdoor|camping|hike|backpack|travel bag|climb|fishing|swim|water park/.test(blob)) {
    return "アウトドア・スポーツ";
  }
  if (/kitchen|food|grill|espresso|coffee|brew|cook|appliance/.test(blob)) {
    return "キッチン・家電";
  }
  if (/mobility|transport|vehicle|ebike|e-bike|scooter|wheelchair|skateboard/.test(blob)) {
    return "モビリティ・乗り物";
  }
  const lower = (category || "").toLowerCase();
  if (
    /technology|gadget|hardware|software|3d printing|robot|phone|nas|scanner|projector|computer|device/.test(
      lower
    )
  ) {
    return "テクノロジー・ガジェット";
  }
  if (/design|lifestyle|fashion|furniture|product|instrument/.test(lower)) {
    return "ライフスタイル・デザイン";
  }
  if (lower.includes("sport")) {
    return "アウトドア・スポーツ";
  }
  return "その他";
}

export function projectMatchesCategoryGroup(
  project: Pick<Project, "category" | "title" | "subtitle">,
  group: string
): boolean {
  if (group === "all") return true;
  return getCategoryGroupJa(project.category, project.title, project.subtitle ?? "") === group;
}

export function buildCategoryOptions(
  projects: Pick<Project, "category" | "title" | "subtitle">[]
): CategoryOption[] {
  const counts = new Map<string, number>();
  for (const project of projects) {
    const group = getCategoryGroupJa(project.category, project.title, project.subtitle ?? "");
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

export function formatCategoryLabel(
  category: string,
  title = "",
  subtitle = ""
): string {
  return getCategoryGroupJa(category, title, subtitle);
}
