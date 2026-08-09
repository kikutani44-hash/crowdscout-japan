import type { Project } from "./types";

export type OfferLanguage = "en" | "zh-TW" | "ko" | "fr" | "de" | "es";

export interface LanguageInfo {
  code: OfferLanguage;
  label: string;
  nativeLabel: string;
}

const LANGUAGE_MAP: Record<OfferLanguage, LanguageInfo> = {
  en: { code: "en", label: "英語", nativeLabel: "English" },
  "zh-TW": { code: "zh-TW", label: "繁体字中国語", nativeLabel: "繁體中文" },
  ko: { code: "ko", label: "韓国語", nativeLabel: "한국어" },
  fr: { code: "fr", label: "フランス語", nativeLabel: "Français" },
  de: { code: "de", label: "ドイツ語", nativeLabel: "Deutsch" },
  es: { code: "es", label: "スペイン語", nativeLabel: "Español" },
};

export function detectLanguage(project: Pick<Project, "platform" | "country">): LanguageInfo {
  // Kickstarter / Indiegogo は英語プラットフォームなので常に英語
  if (project.platform === "kickstarter" || project.platform === "indiegogo") {
    return LANGUAGE_MAP["en"];
  }

  // その他のプラットフォームはプラットフォーム優先
  if (project.platform === "zeczec") return LANGUAGE_MAP["zh-TW"];
  if (project.platform === "wadiz") return LANGUAGE_MAP["ko"];

  // 国で判定
  const country = (project.country ?? "").toLowerCase();
  if (country.includes("hong kong") || country === "tw") return LANGUAGE_MAP["zh-TW"];
  if (country.includes("south korea") || country.includes("korea")) return LANGUAGE_MAP["ko"];
  if (country.includes("france")) return LANGUAGE_MAP["fr"];
  if (country.includes("germany")) return LANGUAGE_MAP["de"];
  if (country.includes("spain")) return LANGUAGE_MAP["es"];

  return LANGUAGE_MAP["en"];
}

export function getLanguageInfo(code: OfferLanguage): LanguageInfo {
  return LANGUAGE_MAP[code] ?? LANGUAGE_MAP["en"];
}
