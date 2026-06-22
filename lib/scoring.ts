import type { Project } from "./types";

export function calculateScore(project: Pick<
  Project,
  "raised_usd" | "goal_usd" | "backers" | "category" | "japan_cf_result"
>): number {
  let score = 0;

  if (project.raised_usd >= 500_000) score += 30;
  else if (project.raised_usd >= 100_000) score += 20;
  else if (project.raised_usd >= 50_000) score += 10;

  const rate = project.goal_usd > 0 ? (project.raised_usd / project.goal_usd) * 100 : 0;
  if (rate >= 500) score += 25;
  else if (rate >= 200) score += 20;
  else if (rate >= 100) score += 10;

  if (project.backers >= 10_000) score += 20;
  else if (project.backers >= 5_000) score += 15;
  else if (project.backers >= 1_000) score += 8;

  if (project.japan_cf_result?.isJapanUnentered) score += 15;
  else if (project.japan_cf_result && !project.japan_cf_result.isJapanUnentered) {
    const foundCount = project.japan_cf_result.sites.filter((s) => s.found).length;
    if (foundCount === 1) score += 5;
  }

  const popularCategories = ["ガジェット", "Gadgets", "Technology", "ヘルスケア", "Health"];
  if (popularCategories.some((c) => project.category.includes(c))) score += 10;
  else score += 5;

  return Math.min(score, 100);
}
