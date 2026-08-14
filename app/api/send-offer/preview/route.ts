import { NextResponse } from "next/server";
import { generateFirstEmailVariables, generateSecondEmailVariables, translateOfferLetterToJapanese } from "@/lib/claude";
import { detectLanguage } from "@/lib/language-detect";
import { buildOfferLetter, buildFollowUpLetter } from "@/lib/offer-letter";
import { findLocalProject } from "@/lib/project-store";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getAiCache, setAiCache, hashVariant, type AiCacheKey } from "@/lib/ai-cache";

export const maxDuration = 60;

type LetterPayload = Record<string, unknown>;

export async function POST(request: Request) {
  try {
    const { projectId, customNote, emailType = "first", regenerate = false } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId が必要です" }, { status: 400 });
    }

    // 同じ案件・同じ備考なら再生成せずキャッシュを返す（Anthropicクレジット節約）
    // 1通目は Sonnet を3回（変数生成 + 日本語訳 + 現地語訳）呼ぶため効果が大きい
    const cacheKey: AiCacheKey = {
      kind: emailType === "second" ? "offer_second" : "offer_first",
      projectId,
      variant: hashVariant(customNote?.trim()),
    };
    if (!regenerate) {
      const cached = await getAiCache<LetterPayload>(cacheKey);
      if (cached) {
        return NextResponse.json({ letter: { ...cached, cached: true } });
      }
    }

    let project = await findLocalProject(projectId);

    if (isSupabaseConfigured()) {
      const supabase = createServerSupabase();
      const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (data) project = data;
    }

    if (!project) {
      return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
    }

    const langInfo = detectLanguage({ platform: project.platform, country: project.country });
    const productTitle = project.title_ja ?? project.title;
    const sharedParams = {
      productTitle,
      subtitle: project.subtitle_ja ?? project.subtitle ?? undefined,
      category: project.category,
      raisedUsd: project.raised_usd,
      backers: project.backers,
      platform: project.platform,
    };

    const { translateOfferLetter } = await import("@/lib/claude");

    if (emailType === "second") {
      const vars = await generateSecondEmailVariables(sharedParams);
      const letter = buildFollowUpLetter({
        productTitle,
        productUrl: project.original_url,
        raisedUsd: project.raised_usd,
        backers: project.backers,
        category: project.category,
        customNote: customNote?.trim() || undefined,
        japanReasons: vars.japanReasons,
        japanMarketOverview: vars.japanMarketOverview,
        targetAudience: vars.targetAudience,
        crowdfundingTarget: vars.crowdfundingTarget,
      });

      const [text_translated, text_ja] = await Promise.all([
        langInfo.code !== "en" ? translateOfferLetter(letter.text, langInfo.code) : Promise.resolve(null),
        translateOfferLetterToJapanese(letter.text),
      ]);

      const payload = {
        ...letter,
        text_translated,
        text_ja,
        lang: langInfo,
        emailType: "second" as const,
      };
      await setAiCache(cacheKey, payload);

      return NextResponse.json({ letter: { ...payload, cached: false } });
    }

    // 1通目
    const vars = await generateFirstEmailVariables(sharedParams);
    const letter = buildOfferLetter({
      productTitle,
      productUrl: project.original_url,
      platform: project.platform,
      raisedUsd: project.raised_usd,
      goalUsd: project.goal_usd,
      backers: project.backers,
      category: project.category,
      customNote: customNote?.trim() || undefined,
      productDescriptionOneLine: vars.productDescriptionOneLine,
      japanAppealPoint: vars.japanAppealPoint,
    });

    const [text_translated, text_ja] = await Promise.all([
      langInfo.code !== "en" ? translateOfferLetter(letter.text, langInfo.code) : Promise.resolve(null),
      translateOfferLetterToJapanese(letter.text),
    ]);

    const payload = {
      ...letter,
      text_translated,
      text_ja,
      lang: langInfo,
      emailType: "first" as const,
      personalized: !!process.env.ANTHROPIC_API_KEY,
    };
    await setAiCache(cacheKey, payload);

    return NextResponse.json({ letter: { ...payload, cached: false } });
  } catch (error) {
    const { parseAnthropicError } = await import("@/lib/api-error");
    return NextResponse.json({ error: parseAnthropicError(error) }, { status: 500 });
  }
}
