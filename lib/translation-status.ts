/**
 * 翻訳が本当に必要かどうかの判定。
 *
 * scripts/translation_utils.py のTypeScript版。
 * 既に日本語訳が入っている案件に対して再度Claude APIを呼ばないためのガード。
 * Python側（クロール時）とWeb API側で判定基準を揃えること。
 */

const JA_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf]/;
const LATIN_RE = /[a-zA-Z]/;

export function hasJapaneseText(text: string | null | undefined): boolean {
  return JA_RE.test(text ?? "");
}

function isBlank(value: string | null | undefined): boolean {
  return !value || !value.trim();
}

function sameAsSource(ja: string | null | undefined, source: string | null | undefined): boolean {
  if (isBlank(ja) || isBlank(source)) return false;
  return ja!.trim() === source!.trim();
}

export function titleNeedsTranslation(
  title: string | null | undefined,
  titleJa: string | null | undefined,
): boolean {
  const src = (title ?? "").trim();
  const ja = (titleJa ?? "").trim();
  if (isBlank(ja)) return true;
  if (sameAsSource(ja, src)) return true;
  if (LATIN_RE.test(src) && !hasJapaneseText(ja)) return true;
  return false;
}

export function subtitleNeedsTranslation(
  subtitle: string | null | undefined,
  subtitleJa: string | null | undefined,
): boolean {
  const src = (subtitle ?? "").trim();
  if (!src) return false;
  const ja = (subtitleJa ?? "").trim();
  if (isBlank(ja)) return true;
  if (sameAsSource(ja, src)) return true;
  if (LATIN_RE.test(src) && !hasJapaneseText(ja)) return true;
  return false;
}

export function needsJapaneseTranslation(project: {
  title?: string | null;
  title_ja?: string | null;
  subtitle?: string | null;
  subtitle_ja?: string | null;
}): boolean {
  return (
    titleNeedsTranslation(project.title, project.title_ja) ||
    subtitleNeedsTranslation(project.subtitle, project.subtitle_ja)
  );
}
