import type { Project } from "./types";

/** Hotness score: higher = fewer days left + stronger backer momentum. */
export function liveMomentumScore(project: Pick<Project, "status" | "days_remaining" | "backers_per_day">): number {
  const momentum = project.backers_per_day ?? 0;
  if (project.status !== "active") {
    return momentum * 0.1;
  }
  const daysLeft = project.days_remaining ?? 999;
  const urgency = 1 + 30 / Math.max(1, daysLeft);
  return momentum * urgency;
}

export function compareProjectsByLiveMomentum(a: Project, b: Project): number {
  const aActive = a.status === "active" ? 1 : 0;
  const bActive = b.status === "active" ? 1 : 0;
  if (aActive !== bActive) return bActive - aActive;

  const scoreDiff = liveMomentumScore(b) - liveMomentumScore(a);
  if (scoreDiff !== 0) return scoreDiff;

  const daysA = a.days_remaining ?? 9999;
  const daysB = b.days_remaining ?? 9999;
  if (aActive && daysA !== daysB) return daysA - daysB;

  return (b.backers_per_day ?? 0) - (a.backers_per_day ?? 0);
}

export function formatDaysRemaining(days: number | null | undefined, status: Project["status"]): string {
  if (status !== "active") return "終了";
  if (days == null) return "—";
  if (days <= 0) return "終了間近";
  return `残り${days}日`;
}

/**
 * 終了からの経過を「8ヶ月前」のような表記にする。
 *
 * 過去案件へオファーをかける際、どれくらい前に終わった案件かは
 * 「まだ日本に入っていない可能性」と「相手がまだ動いているか」の
 * 両方の判断材料になるため、カード上で必ず見えるようにする。
 * まだ終了していない場合は null。
 */
export function formatMonthsSinceEnd(
  deadlineAt: string | null | undefined,
): string | null {
  if (!deadlineAt) return null;
  const end = new Date(deadlineAt).getTime();
  if (Number.isNaN(end)) return null;

  const days = Math.floor((Date.now() - end) / 86_400_000);
  if (days < 0) return null; // まだ終わっていない

  if (days < 30) return `${days}日前`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months}ヶ月前`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years}年前` : `${years}年${rest}ヶ月前`;
}

/** 終了日を「2025/03/14」形式で返す（ツールチップ等で正確な日付を出す用）。 */
export function formatEndDate(deadlineAt: string | null | undefined): string | null {
  if (!deadlineAt) return null;
  const d = new Date(deadlineAt);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function formatBackersPerDay(value: number | null | undefined): string {
  const n = value ?? 0;
  if (n >= 100) return `${Math.round(n)}人/日`;
  if (n >= 10) return `${n.toFixed(1)}人/日`;
  return `${n.toFixed(2)}人/日`;
}

export function matchesLiveHotFilter(
  project: Pick<Project, "status" | "days_remaining" | "backers_per_day">,
  enabled: boolean
): boolean {
  if (!enabled) return true;
  if (project.status !== "active") return false;
  const days = project.days_remaining ?? 999;
  const momentum = project.backers_per_day ?? 0;
  return days <= 21 && momentum >= 1;
}
