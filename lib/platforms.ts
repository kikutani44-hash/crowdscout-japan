import type { Platform } from "@/lib/types";

export type PlatformFilterValue = "all" | Platform | "wadiz" | "zeczec";

export interface PlatformFilterOption {
  value: PlatformFilterValue;
  label: string;
  comingSoon?: boolean;
}

export const PLATFORM_FILTER_OPTIONS: PlatformFilterOption[] = [
  { value: "all", label: "すべて" },
  { value: "kickstarter", label: "Kickstarter" },
  { value: "indiegogo", label: "Indiegogo" },
  { value: "wadiz", label: "Wadiz（韓国）" },
  { value: "zeczec", label: "Zeczec（台湾）", comingSoon: true },
];

export function isComingSoonPlatform(value: PlatformFilterValue): boolean {
  return value === "zeczec";
}

export function buildPlatformCounts(
  projects: { platform: Platform }[]
): Partial<Record<PlatformFilterValue, number>> {
  const counts: Partial<Record<PlatformFilterValue, number>> = {
    all: projects.length,
    wadiz: 0,
    zeczec: 0,
  };
  for (const p of projects) {
    counts[p.platform] = (counts[p.platform] ?? 0) + 1;
  }
  return counts;
}
