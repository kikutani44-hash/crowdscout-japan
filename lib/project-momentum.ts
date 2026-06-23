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
