import type { Project } from "./types";

/** Returns true if the string contains Japanese script (hiragana, katakana, kanji). */
export function hasJapaneseText(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf]/.test(text);
}

function isBlank(value: string | null | undefined): boolean {
  return !value || !value.trim();
}

function isSameAsSource(ja: string | null | undefined, source: string | null | undefined): boolean {
  if (isBlank(ja) || isBlank(source)) return false;
  return ja!.trim() === source!.trim();
}

function titleNeedsTranslation(project: Pick<Project, "title" | "title_ja">): boolean {
  const title = (project.title ?? "").trim();
  const titleJa = (project.title_ja ?? "").trim();

  if (isBlank(titleJa)) return true;
  if (isSameAsSource(titleJa, title)) return true;
  if (/[a-zA-Z]/.test(title) && !hasJapaneseText(titleJa)) return true;
  return false;
}

function subtitleNeedsTranslation(
  project: Pick<Project, "subtitle" | "subtitle_ja">
): boolean {
  const subtitle = (project.subtitle ?? "").trim();
  if (!subtitle) return false;

  const subtitleJa = (project.subtitle_ja ?? "").trim();
  if (isBlank(subtitleJa)) return true;
  if (isSameAsSource(subtitleJa, subtitle)) return true;
  if (/[a-zA-Z]/.test(subtitle) && !hasJapaneseText(subtitleJa)) return true;
  return false;
}

/** True when title_ja / subtitle_ja are missing or still English copies of the source. */
export function needsJapaneseTranslation(
  project: Pick<Project, "title" | "title_ja" | "subtitle" | "subtitle_ja">
): boolean {
  return titleNeedsTranslation(project) || subtitleNeedsTranslation(project);
}

/** Prefer Supabase title_ja when it is a real Japanese translation. */
export function getDisplayTitle(project: Pick<Project, "title" | "title_ja">): string {
  if (!titleNeedsTranslation(project)) {
    return (project.title_ja ?? "").trim() || project.title;
  }
  return project.title;
}

/** Prefer Supabase subtitle_ja when it is a real Japanese translation. */
export function getDisplaySubtitle(
  project: Pick<Project, "subtitle" | "subtitle_ja">
): string | null {
  const subtitle = project.subtitle?.trim();
  if (!subtitle) return null;

  if (!subtitleNeedsTranslation(project)) {
    return (project.subtitle_ja ?? "").trim() || subtitle;
  }
  return subtitle;
}

export function hasValidJapaneseTitle(
  project: Pick<Project, "title" | "title_ja" | "subtitle" | "subtitle_ja">
): boolean {
  return !titleNeedsTranslation(project);
}
