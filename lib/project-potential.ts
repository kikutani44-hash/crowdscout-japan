import type { Project } from "@/lib/types";

/**
 * 新着ポテンシャルスコア（0-100）
 * 調達額の絶対値ではなく「勢い・達成率・新鮮さ」で評価。
 * 早期アプローチ価値が高い案件ほど高得点になる。
 */
export function newPotentialScore(project: Project): number {
  let score = 0;

  // 達成率（伸び率の指標）— 最大30点
  const rate = project.goal_usd > 0 ? (project.raised_usd / project.goal_usd) * 100 : 0;
  if (rate >= 500) score += 30;
  else if (rate >= 200) score += 22;
  else if (rate >= 100) score += 15;
  else if (rate >= 50) score += 8;

  // 1日あたり支援者数（勢い）— 最大25点
  const bpd = project.backers_per_day ?? 0;
  if (bpd >= 50) score += 25;
  else if (bpd >= 20) score += 20;
  else if (bpd >= 10) score += 15;
  else if (bpd >= 5) score += 10;
  else if (bpd >= 2) score += 5;
  else if (bpd >= 1) score += 2;

  // 残り日数（まだ伸びしろがある）— 最大15点
  if (project.status === "active" && project.days_remaining != null) {
    if (project.days_remaining >= 25) score += 15;
    else if (project.days_remaining >= 15) score += 10;
    else if (project.days_remaining >= 7) score += 5;
  }

  // 新しさ（created_at が最近ほど高得点）— 最大20点
  const ageMs = Date.now() - new Date(project.created_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 7) score += 20;
  else if (ageDays <= 14) score += 15;
  else if (ageDays <= 30) score += 10;
  else if (ageDays <= 60) score += 4;

  // 日本未参入ボーナス — 最大10点
  if (project.japan_cf_result?.isJapanUnentered) score += 10;

  return Math.min(score, 100);
}

/** ⚡バッジ表示の閾値 */
export function isHighPotential(project: Project): boolean {
  return newPotentialScore(project) >= 55;
}

/** 新着ポテンシャル順ソート */
export function compareByNewPotential(a: Project, b: Project): number {
  return newPotentialScore(b) - newPotentialScore(a);
}

/** 新着フィルター（DB登録から30日以内） */
export function isRecentProject(project: Project, days = 30): boolean {
  const ageMs = Date.now() - new Date(project.created_at).getTime();
  return ageMs <= days * 24 * 60 * 60 * 1000;
}
