import { NextResponse } from "next/server";
import { generateFirstEmailVariables, generateSecondEmailVariables, translateOfferLetterToJapanese } from "@/lib/claude";
import { detectLanguage } from "@/lib/language-detect";
import { buildOfferLetter, buildFollowUpLetter } from "@/lib/offer-letter";
import { findLocalProject } from "@/lib/project-store";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { projectId, customNote, emailType = "first" } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId が必要です" }, { status: 400 });
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

      const text_translated = langInfo.code !== "en"
        ? await import("@/lib/claude").then((m) => m.translateOfferLetter(letter.text, langInfo.code))
        : null;
      const text_ja = await translateOfferLetterToJapanese(letter.text);

      return NextResponse.json({
        letter: { ...letter, text_translated, text_ja, lang: langInfo, emailType: "second" },
      });
    }

    // 1通目
    const vars = await generateFirstEmailVariables(sharedParams);
    const letter = buildOfferLetter({
      productTitle,
      productUrl: project.original_url,
      platform: project.platform,
      raisedUsd: project.raised_usd,
      backers: project.backers,
      category: project.category,
      customNote: customNote?.trim() || undefined,
      productDescriptionOneLine: vars.productDescriptionOneLine,
      japanAppealPoint: vars.japanAppealPoint,
    });

    const text_translated = langInfo.code !== "en"
      ? await import("@/lib/claude").then((m) => m.translateOfferLetter(letter.text, langInfo.code))
      : null;
    const text_ja = await translateOfferLetterToJapanese(letter.text);

    return NextResponse.json({
      letter: {
        ...letter,
        text_translated,
        text_ja,
        lang: langInfo,
        emailType: "first",
        personalized: !!process.env.ANTHROPIC_API_KEY,
      },
    });
  } catch (error) {
    const { parseAnthropicError } = await import("@/lib/api-error");
    return NextResponse.json({ error: parseAnthropicError(error) }, { status: 500 });
  }
}
