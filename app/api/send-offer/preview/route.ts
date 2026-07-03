import { NextResponse } from "next/server";
import { generatePersonalizedOffer, translateOfferLetterToJapanese } from "@/lib/claude";
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

    if (emailType === "second") {
      // 2通目: 日本市場レポート付きフォローアップ
      const letter = buildFollowUpLetter({
        productTitle: project.title_ja ?? project.title,
        productUrl: project.original_url,
        raisedUsd: project.raised_usd,
        backers: project.backers,
        category: project.category,
        customNote: customNote?.trim() || undefined,
      });

      const [text_translated, text_ja] = await Promise.all([
        langInfo.code !== "en"
          ? import("@/lib/claude").then((m) => m.translateOfferLetter(letter.text, langInfo.code))
          : Promise.resolve(null),
        translateOfferLetterToJapanese(letter.text),
      ]);

      return NextResponse.json({
        letter: {
          ...letter,
          text_translated,
          text_ja,
          lang: langInfo,
          emailType: "second",
        },
      });
    }

    // 1通目: Claude APIでパーソナライズ生成
    const personalized = await generatePersonalizedOffer({
      productTitle: project.title_ja ?? project.title,
      productUrl: project.original_url,
      raisedUsd: project.raised_usd,
      backers: project.backers,
      category: project.category,
      subtitle: project.subtitle_ja ?? project.subtitle ?? undefined,
      customNote: customNote?.trim() || undefined,
      targetLang: langInfo.code,
    });

    // For non-English, if generated in English (fallback), also translate
    // For Japanese reference
    const text_ja = await translateOfferLetterToJapanese(personalized.text);

    // Build HTML version from the text
    const htmlBody = personalized.text
      .split("\n\n")
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("\n");

    const html = `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; line-height: 1.7; max-width: 600px; margin: 0 auto;">
${htmlBody}
</body>
</html>`;

    // If generated in target language, no separate translation needed
    const text_translated = langInfo.code !== "en" ? personalized.text : null;
    const text_en = langInfo.code !== "en"
      ? buildOfferLetter({
          productTitle: project.title_ja ?? project.title,
          productUrl: project.original_url,
          raisedUsd: project.raised_usd,
          backers: project.backers,
          category: project.category,
        }).text
      : personalized.text;

    return NextResponse.json({
      letter: {
        subject: personalized.subject,
        text: text_en,
        html,
        text_translated,
        text_ja,
        lang: langInfo,
        emailType: "first",
        personalized: !!process.env.ANTHROPIC_API_KEY,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "プレビュー生成に失敗しました" },
      { status: 500 }
    );
  }
}
