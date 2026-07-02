import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

export async function translateToJapanese(title: string, subtitle: string): Promise<{
  title_ja: string;
  subtitle_ja: string;
}> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      title_ja: `【翻訳デモ】${title}`,
      subtitle_ja: `【翻訳デモ】${subtitle.slice(0, 120)}...`,
    };
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `以下のクラウドファンディング商品情報を自然な日本語に翻訳してください。JSON形式で返してください。

{"title_ja": "...", "subtitle_ja": "..."}

title: ${title}
subtitle: ${subtitle}`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("翻訳結果の解析に失敗しました");
  }

  return JSON.parse(jsonMatch[0]) as { title_ja: string; subtitle_ja: string };
}

export interface JapanMarketReportData {
  whySellsInJapan: string;      // 日本で売れる理由（箇条書き複数行）
  marketOverview: string;        // 日本市場概況
  targetAudience: string;        // ターゲット層
  salesStrategy: string;         // 販売戦略・チャネル提案
  competitiveEdge: string;       // 競合優位性
}

export async function generateJapanMarketReport(
  productTitle: string,
  productSubtitle: string,
  category: string,
  raisedUsd: number,
  backers: number,
  platform: string,
): Promise<JapanMarketReportData> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      whySellsInJapan:
        "・日本市場では革新的なガジェットへの需要が高く、早期採用者層が厚い\n・クラウドファンディング文化が根付いており（Makuake・CAMPFIRE）、支援者のリテラシーが高い\n・品質と独自性を重視する消費者が多く、海外発の製品に対する信頼性も高い",
      marketOverview:
        "日本のクラウドファンディング市場は年間1,000億円規模に成長しており、Makuakeを中心に海外製品の日本初上陸案件が人気を集めています。",
      targetAudience:
        "30〜50代の男性を中心に、ガジェット好き・アーリーアダプター層。SNS・YouTubeで情報収集する層が主なターゲットです。",
      salesStrategy:
        "Makuake・CAMPFIRE・GREEN FUNDINGでのクラウドファンディング展開を軸に、テレビショッピング・Amazon Japan・ヤマダ電機等への展開も視野に入れます。",
      competitiveEdge:
        "類似製品が日本市場に存在しないため、先行者優位を確立できます。独占販売契約により参入障壁を構築します。",
    };
  }

  const prompt = `あなたは海外クラウドファンディング製品の日本市場参入を専門とするアナリストです。
以下の海外クラウドファンディング製品について、日本市場展開の提案書に使う各セクションの文章を生成してください。

製品情報:
- タイトル: ${productTitle}
- サブタイトル/説明: ${productSubtitle || "（なし）"}
- カテゴリ: ${category || "未分類"}
- プラットフォーム: ${platform}
- 調達額: $${raisedUsd.toLocaleString("en-US")}
- 支援者数: ${backers.toLocaleString()}人

以下のJSONフォーマットで返してください。各フィールドは日本語で記述し、具体的・説得力のある内容にしてください。

{
  "whySellsInJapan": "この製品が日本で売れる理由を3〜5点、「・」始まりの箇条書きで（製品の具体的な特徴と日本市場の需要を結びつけること）",
  "marketOverview": "日本における関連市場の概況（市場規模・成長率・トレンド）を2〜3文で",
  "targetAudience": "日本でのメインターゲット層（年齢・性別・ライフスタイル・購買動機）を2〜3文で",
  "salesStrategy": "日本での販売戦略（クラウドファンディング→小売展開のロードマップ）を3〜4文で",
  "competitiveEdge": "日本市場での競合優位性と独占販売の意義を2〜3文で"
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("レポート生成結果の解析に失敗しました");
  return JSON.parse(jsonMatch[0]) as JapanMarketReportData;
}

export async function translateOfferLetterToJapanese(englishText: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return `【翻訳デモ — ANTHROPIC_API_KEY 未設定】\n\n${englishText}`;
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `以下の英文ビジネスメール（オファーレター）を、自然で丁寧な日本語に翻訳してください。

ルール:
- 会社名・メールアドレス・URL・商品名は原文のまま、または適切な表記で残す
- ビジネスメールとして読みやすい文体にする
- 翻訳本文のみを返す（説明やJSONは不要）

--- 英文 ---
${englishText}`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  if (!text.trim()) {
    throw new Error("翻訳結果が空です");
  }
  return text.trim();
}
