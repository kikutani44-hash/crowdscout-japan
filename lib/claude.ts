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
  headlineJa: string;
  headlineEn: string;
  whySellsInJapan: string;
  whySellsInJapanEn: string;
  marketOverview: string;
  marketOverviewEn: string;
  targetAudience: string;
  targetAudienceEn: string;
  salesStrategy: string;
  salesStrategyEn: string;
  competitiveEdge: string;
  competitiveEdgeEn: string;
  marketSizeJpy: string;
  growthRate: string;
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
      headlineJa: `一緒に、${productTitle}を日本市場へ届けましょう`,
      headlineEn: `Together, let's bring ${productTitle} to Japan`,
      whySellsInJapan: "・日本市場では革新的なガジェットへの需要が高く、早期採用者層が厚い\n・Makuake・CAMPFIREでのクラウドファンディング文化が根付いており支援者リテラシーが高い\n・品質と独自性を重視する消費者が多く、海外発製品への信頼性も高い",
      whySellsInJapanEn: "• Strong demand for innovative gadgets with a thick early adopter base\n• Established crowdfunding culture on Makuake & CAMPFIRE with high-literacy backers\n• Quality-conscious consumers with strong trust in overseas products",
      marketOverview: "日本のクラウドファンディング市場は年間1,000億円規模に成長しており、Makuakeを中心に海外製品の日本初上陸案件が人気を集めています。",
      marketOverviewEn: "Japan's crowdfunding market has grown to ¥100B annually, with Makuake leading demand for overseas products making their Japan debut.",
      targetAudience: "30〜50代のガジェット好き・アーリーアダプター層。SNS・YouTubeで情報収集し、品質に投資する消費者が主なターゲットです。",
      targetAudienceEn: "Gadget enthusiasts and early adopters aged 30–50 who research via SNS and YouTube and invest in quality products.",
      salesStrategy: "まずMakuake・CAMPFIREでクラウドファンディング展開し、成功実績を基にAmazon Japan・ヤマダ電機・テレビショッピングへ展開します。",
      salesStrategyEn: "Launch via Makuake & CAMPFIRE crowdfunding, then expand to Amazon Japan, Yamada Denki, and TV shopping based on proven results.",
      competitiveEdge: "類似製品が日本市場に存在しないため先行者優位を確立でき、独占販売契約により参入障壁を構築できます。",
      competitiveEdgeEn: "No comparable products exist in Japan, enabling first-mover advantage and exclusive distribution rights as a market barrier.",
      marketSizeJpy: "1,000億円",
      growthRate: "8.5%",
    };
  }

  const prompt = `You are a senior Japan market consultant specializing in bringing overseas crowdfunding products to Japan. Write a compelling, detailed bilingual market proposal JSON. Be specific, use concrete data, and write persuasively to convince the maker to partner with Blink Japan.

Product:
- Title: ${productTitle}
- Description: ${productSubtitle || "N/A"}
- Category: ${category || "Consumer"}
- Platform: ${platform}
- Raised: $${raisedUsd.toLocaleString("en-US")} from ${backers.toLocaleString()} backers

Return ONLY valid JSON with these fields (write richly — each field should be substantive):
{
  "headlineJa": "compelling emotional Japanese headline (1 powerful sentence that creates urgency/excitement)",
  "headlineEn": "same in English",
  "whySellsInJapan": "5-6 bullet points in Japanese starting with ・, each with a specific reason tied to Japanese culture/market with 1-2 supporting sentences per point",
  "whySellsInJapanEn": "same 5-6 bullets in English starting with •",
  "marketOverview": "3-4 sentences in Japanese: include specific market size data, growth trends, relevant consumer behavior insights, and why NOW is the right timing",
  "marketOverviewEn": "same in English",
  "targetAudience": "3-4 sentences in Japanese: describe primary AND secondary Japanese target segments with demographics, psychographics, buying triggers, and media habits",
  "targetAudienceEn": "same in English",
  "salesStrategy": "4-5 sentences in Japanese: detailed roadmap — Phase 1 crowdfunding (Makuake/CAMPFIRE) with timeline and targets, Phase 2 retail expansion (Amazon Japan/specialty stores), Phase 3 mass market (TV shopping/major chains)",
  "salesStrategyEn": "same in English",
  "competitiveEdge": "3-4 sentences in Japanese: explain the exclusive partnership value, first-mover advantage, Blink Japan's network, and specific risk mitigation for the maker",
  "competitiveEdgeEn": "same in English",
  "marketSizeJpy": "estimated Japan market size in 億円 format (research-based estimate)",
  "growthRate": "estimated annual growth rate e.g. '12.3%'"
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("レポート生成結果の解析に失敗しました");
  return JSON.parse(jsonMatch[0]) as JapanMarketReportData;
}

export interface PersonalizedOfferResult {
  subject: string;
  text: string;
}

// Claude APIを使って商品情報をもとにパーソナライズされた1通目オファーメールを生成
export async function generatePersonalizedOffer(params: {
  productTitle: string;
  productUrl: string;
  raisedUsd: number;
  backers: number;
  category?: string;
  subtitle?: string;
  description?: string;
  customNote?: string;
  targetLang: string;
}): Promise<PersonalizedOfferResult> {
  const achievement = `$${params.raisedUsd.toLocaleString("en-US")} from ${params.backers.toLocaleString()} backers`;

  const langInstructions: Record<string, string> = {
    en: "Write the email in English.",
    ko: "Write the email in Korean (한국어). Use natural, polite Korean business email style.",
    "zh-TW": "Write the email in Traditional Chinese (繁體中文). Use natural, polite Taiwanese business email style.",
  };

  const langInstruction = langInstructions[params.targetLang] ?? "Write the email in English.";

  if (!process.env.ANTHROPIC_API_KEY) {
    // Fallback template when API is not configured
    const subject = `${params.productTitle} — Japan Launch Opportunity`;
    const text = `Hi,

I came across your "${params.productTitle}" campaign — raising ${achievement} is a remarkable achievement.

I'm reaching out from Blink Japan Co., Ltd., a Japan-based firm specializing in bringing successful crowdfunding products to the Japanese market through exclusive partnerships on Makuake, CAMPFIRE, and Green Funding.

I've prepared a Japan market analysis for "${params.productTitle}". Would you be open to taking a look?

Best regards,
Yoshitaka Kikutani
Blink Japan Co., Ltd.
cbec@blink-japan.com
https://blink-japan.com/

Campaign: ${params.productUrl}`;
    return { subject, text };
  }

  const productContext = [
    `Product: ${params.productTitle}`,
    params.subtitle ? `Description: ${params.subtitle}` : "",
    params.description ? `Details: ${params.description.slice(0, 500)}` : "",
    `Category: ${params.category ?? "Consumer product"}`,
    `Crowdfunding Achievement: ${achievement}`,
    `Campaign URL: ${params.productUrl}`,
    params.customNote ? `Additional note to include: ${params.customNote}` : "",
  ].filter(Boolean).join("\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are writing a cold outreach email on behalf of Yoshitaka Kikutani at Blink Japan Co., Ltd. (cbec@blink-japan.com, https://blink-japan.com/).

The purpose is to reach out to a crowdfunding product creator to offer Japan exclusive distribution rights through Japanese crowdfunding platforms (Makuake, CAMPFIRE, Green Funding) and retail channels.

This is the FIRST email (hook email). Keep it SHORT (max 4 paragraphs). The goal is simply to get a reply — mention that you have a Japan market analysis ready for them. Do NOT include the full analysis yet.

Key rules:
- Personalize based on the specific product details below
- Mention one specific thing about the product that makes it interesting for Japan
- Do NOT be generic — avoid clichés like "I hope this email finds you well"
- Sound genuine and direct, not salesy
- End with a clear, low-friction call to action ("Would you be open to a quick look?")
- ${langInstruction}
- Sender name: Yoshitaka Kikutani, Company: Blink Japan Co., Ltd., Email: cbec@blink-japan.com

Product Information:
${productContext}

Return JSON with exactly two fields:
{"subject": "...", "text": "..."}
The text field should be the full email body (plain text, use \\n for newlines).`,
      },
    ],
  });

  const content = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // If JSON parsing fails, use fallback
    const subject = `${params.productTitle} — Japan Launch Opportunity`;
    return { subject, text: content };
  }

  const result = JSON.parse(jsonMatch[0]) as PersonalizedOfferResult;
  return result;
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

const LANG_NAMES: Record<string, string> = {
  "zh-TW": "繁體中文（台灣）",
  ko: "한국어",
  fr: "français",
  de: "Deutsch",
  es: "español",
  en: "English",
};

export async function translateOfferLetter(
  englishText: string,
  targetLang: string,
): Promise<string> {
  if (targetLang === "en") return englishText;

  if (!process.env.ANTHROPIC_API_KEY) {
    return `【翻訳デモ (${targetLang}) — ANTHROPIC_API_KEY 未設定】\n\n${englishText}`;
  }

  const langName = LANG_NAMES[targetLang] ?? targetLang;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Please translate the following business email into ${langName}.

Rules:
- Keep company names, email addresses, URLs, and product names as-is
- Use natural, polite business email tone appropriate for ${langName}
- Return only the translated email body (no explanations)

--- Original English ---
${englishText}`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  if (!text.trim()) throw new Error("翻訳結果が空です");
  return text.trim();
}

// ===== 新メールテンプレート用AI変数生成 =====

export interface FirstEmailVariables {
  productDescriptionOneLine: string;
  japanAppealPoint: string;
}

export interface SecondEmailVariables {
  japanReasons: string;
  japanMarketOverview: string;
  targetAudience: string;
  crowdfundingTarget: string;
}

export async function generateFirstEmailVariables(params: {
  productTitle: string;
  subtitle?: string;
  category?: string;
  raisedUsd: number;
  backers: number;
  platform: string;
}): Promise<FirstEmailVariables> {
  const fallback: FirstEmailVariables = {
    productDescriptionOneLine: `A highly successful ${params.category ?? "consumer product"} that raised $${params.raisedUsd.toLocaleString("en-US")} from ${params.backers.toLocaleString()} backers.`,
    japanAppealPoint: "its innovative design and functionality",
  };

  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `You are writing variables for a Japan business outreach email. Generate two concise English phrases for the product below.

Product: ${params.productTitle}
Category: ${params.category ?? "Consumer product"}
${params.subtitle ? `Description: ${params.subtitle}` : ""}
Raised: $${params.raisedUsd.toLocaleString("en-US")} from ${params.backers.toLocaleString()} backers
Platform: ${params.platform}

Return ONLY valid JSON (no markdown):
{
  "productDescriptionOneLine": "One sentence (max 20 words) describing what this product does",
  "japanAppealPoint": "A short phrase (5–12 words) explaining what specifically resonates with Japanese consumers about this product"
}`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    return JSON.parse(match[0]) as FirstEmailVariables;
  } catch {
    return fallback;
  }
}

export async function generateSecondEmailVariables(params: {
  productTitle: string;
  subtitle?: string;
  category?: string;
  raisedUsd: number;
  backers: number;
  platform: string;
}): Promise<SecondEmailVariables> {
  const fallback: SecondEmailVariables = {
    japanReasons: `・Proven global demand with $${params.raisedUsd.toLocaleString("en-US")} raised\n・Strong fit with Japanese consumer preferences\n・No competing product currently in the Japan market`,
    japanMarketOverview: `Japan is the world's third-largest consumer market with strong appetite for innovative ${params.category ?? "consumer"} products. The market size for this category exceeds ¥500 billion annually.`,
    targetAudience: `Primarily urban Japanese professionals aged 30–45 who value quality and innovation. Secondary audience includes tech-savvy younger consumers and gift buyers.`,
    crowdfundingTarget: "3,000,000〜5,000,000",
  };

  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a Japan market analyst. Generate report summary variables in English for a business email about launching this product in Japan.

Product: ${params.productTitle}
Category: ${params.category ?? "Consumer product"}
${params.subtitle ? `Description: ${params.subtitle}` : ""}
Raised: $${params.raisedUsd.toLocaleString("en-US")} from ${params.backers.toLocaleString()} backers
Platform: ${params.platform}

Return ONLY valid JSON (no markdown):
{
  "japanReasons": "3–4 bullet points (one per line, starting with ・) explaining why this product will succeed in Japan",
  "japanMarketOverview": "2–3 sentences on Japan market size and opportunity for this product category",
  "targetAudience": "2–3 sentences describing the primary Japanese target audience segments",
  "crowdfundingTarget": "Realistic JPY target range for Makuake/CAMPFIRE crowdfunding (e.g. '3,000,000〜5,000,000')"
}`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    return JSON.parse(match[0]) as SecondEmailVariables;
  } catch {
    return fallback;
  }
}

export interface SnsDmResult {
  platform: "instagram" | "twitter" | "facebook";
  text: string;
  lang: string;
  charCount: number;
}

// SNS DM自動生成（Instagram/X向け）
export async function generateSnsDm(params: {
  productTitle: string;
  productSubtitle: string | null;
  category: string;
  raisedUsd: number;
  platform: "instagram" | "twitter" | "facebook";
  targetLang: string; // "en" | "zh-TW" | "ko" etc.
}): Promise<SnsDmResult> {
  const { productTitle, productSubtitle, category, raisedUsd, platform, targetLang } = params;

  const charLimit = platform === "twitter" ? 140 : 500;
  const platformName = platform === "twitter" ? "X (Twitter)" : platform === "instagram" ? "Instagram" : "Facebook";

  const langName = LANG_NAMES[targetLang] ?? "English";

  const demoText = platform === "twitter"
    ? `Hi! We're Blink Japan, helping overseas products launch in Japan. Your ${productTitle} looks perfect for the Japanese market! Interested in discussing a Japan launch? 🇯🇵`
    : `Hi! We're Blink Japan, a company that helps exceptional overseas crowdfunding products enter the Japanese market.\n\nYour ${productTitle} raised $${Math.round(raisedUsd / 1000)}K — it has amazing potential in Japan!\n\nWe'd love to discuss a Japan launch. Would you be open to a quick chat?`;

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      platform,
      text: demoText,
      lang: targetLang,
      charCount: demoText.length,
    };
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are writing a ${platformName} DM to a crowdfunding maker to propose a Japan market launch.

Product: ${productTitle}
Category: ${category}
Raised: $${Math.round(raisedUsd / 1000)}K
${productSubtitle ? `Description: ${productSubtitle}` : ""}

Rules:
- Write in ${langName}
- Maximum ${charLimit} characters
- Friendly and genuine, not salesy
- Mention we're Blink Japan (Japanese crowdfunding launch specialist)
- Express specific interest in THIS product
- End with a clear soft CTA (interested? / would love to chat)
- ${platform === "twitter" ? "Very concise, punchy, use 1-2 emojis max" : "Natural DM tone, 3-4 short paragraphs"}
- Do NOT use formal email greetings like "Dear Sir/Madam"
- Return only the DM text, nothing else`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : demoText;
  return {
    platform,
    text,
    lang: targetLang,
    charCount: text.length,
  };
}

// 日本向けクラファンページテキスト自動生成
export interface JapanPageContent {
  catchcopy: string;         // キャッチコピー（30文字以内）
  intro: string;             // 導入文（200文字）
  features: string[];        // 特徴3-5個
  targetDescription: string; // ターゲット説明
  faq: Array<{ q: string; a: string }>; // よくある質問3個
  callToAction: string;      // CTA文
}

export async function generateJapanPageContent(params: {
  productTitle: string;
  productSubtitle: string | null;
  category: string;
  raisedUsd: number;
  backers: number;
  platform: string; // makuake | campfire | greenfunding
}): Promise<JapanPageContent> {
  const { productTitle, productSubtitle, category, raisedUsd, backers, platform } = params;

  const platformName = platform === "makuake" ? "Makuake" : platform === "campfire" ? "CAMPFIRE" : "Green Funding";

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      catchcopy: `海外で${Math.round(raisedUsd / 1000)}万円を集めた${productTitle}`,
      intro: `海外クラウドファンディングで${backers.toLocaleString()}人が支援した${productTitle}が、ついに日本上陸。`,
      features: ["特徴1", "特徴2", "特徴3"],
      targetDescription: "ガジェット好きの30-40代男性・働き盛りのビジネスパーソン",
      faq: [
        { q: "日本語サポートはありますか？", a: "はい、日本語でのサポートに対応しています。" },
        { q: "保証はありますか？", a: "1年間の製品保証がつきます。" },
        { q: "配送はいつですか？", a: "支援終了後、約3ヶ月でお届けします。" },
      ],
      callToAction: "今すぐ支援して、日本最速でお届けを受け取ろう",
    };
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `あなたは日本のクラウドファンディングの優秀なコピーライターです。
海外クラファン商品の${platformName}向け日本語ページコンテンツを生成してください。

商品名: ${productTitle}
カテゴリ: ${category}
海外での調達額: $${Math.round(raisedUsd / 1000)}K (約${Math.round(raisedUsd * 150 / 10000)}万円)
支援者数: ${backers.toLocaleString()}人
${productSubtitle ? `商品説明: ${productSubtitle}` : ""}

以下のJSON形式で返してください：
{
  "catchcopy": "30文字以内のキャッチコピー（数字・実績を入れる）",
  "intro": "200文字程度の導入文（海外実績→日本上陸の流れ）",
  "features": ["特徴1（簡潔に）", "特徴2", "特徴3", "特徴4", "特徴5"],
  "targetDescription": "ターゲット層の説明（具体的に）",
  "faq": [
    {"q": "質問1", "a": "回答1"},
    {"q": "質問2", "a": "回答2"},
    {"q": "質問3", "a": "回答3"}
  ],
  "callToAction": "支援を促すCTA文（20文字以内）"
}`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("ページコンテンツの生成に失敗しました");
  return JSON.parse(jsonMatch[0]) as JapanPageContent;
}
