export interface OfferLetterInput {
  productTitle: string;
  productUrl: string;
  platform: string;
  raisedUsd: number;
  backers: number;
  category?: string;
  customNote?: string;
  // AI-generated variables
  productDescriptionOneLine: string;
  japanAppealPoint: string;
}

export interface FollowUpLetterInput {
  productTitle: string;
  productUrl: string;
  raisedUsd: number;
  backers: number;
  category?: string;
  customNote?: string;
  // AI-generated variables
  japanReasons: string;
  japanMarketOverview: string;
  targetAudience: string;
  crowdfundingTarget: string;
}

export interface OfferLetterContent {
  subject: string;
  text: string;
  html: string;
}

const COMPANY = "Blink Japan Co., Ltd.";
const CONTACT_EMAIL = "cbec@blink-japan.com";
const COMPANY_URL = "https://blink-japan.com/";
const SENDER = "Yoshitaka Kikutani";

function platformDisplayName(platform: string): string {
  const map: Record<string, string> = {
    kickstarter: "Kickstarter",
    indiegogo: "Indiegogo",
    wadiz: "Wadiz",
    zeczec: "Zeczec",
  };
  return map[platform?.toLowerCase()] ?? platform ?? "Kickstarter";
}

// 1通目：フックメール
export function buildOfferLetter(input: OfferLetterInput): OfferLetterContent {
  const subject = `${input.productTitle} — Japan Market Launch Opportunity`;
  const raised = `$${input.raisedUsd.toLocaleString("en-US")}`;
  const backers = input.backers.toLocaleString();
  const platform = platformDisplayName(input.platform);
  const customBlock = input.customNote ? `\n${input.customNote}\n` : "";

  const text = `Dear ${input.productTitle} Team,

I came across your campaign for ${input.productTitle} on ${platform} — congratulations on raising over ${raised} from ${backers} backers. ${input.productDescriptionOneLine}

My name is ${SENDER}, and I represent Blink Japan, a company with deep roots in Japanese media, marketing, and consumer distribution.

I believe ${input.productTitle} has exceptional potential in Japan, where ${input.japanAppealPoint} resonates deeply with consumers.

What sets us apart from other distributors:

・TV & Media Network — 40+ years in the Japanese television industry, with direct connections to home shopping networks, major broadcasters, and production companies

・Digital Marketing — Certified agency for Yahoo! Japan and Google, having managed over ¥12 billion in advertising, consistently delivering top-tier results in performance marketing

・Market Access — Through our extensive network in Japan's digital business community, we maintain strong relationships with leading e-commerce platforms and online marketing channels, including connections to Japan's top crowdfunding platforms, Makuake and CAMPFIRE.

We have prepared a Japan Market Analysis Report for ${input.productTitle}, covering market size, target demographics, and a step-by-step launch roadmap.

Would you be open to receiving it?
${customBlock}
We would love to hear your thoughts — even a brief reply would mean a great deal to us.

Warm regards,

${SENDER}
${COMPANY}
${CONTACT_EMAIL}
${COMPANY_URL}`;

  const html = buildHtml(text);
  return { subject, text, html };
}

// 2通目：レポート送付メール
export function buildFollowUpLetter(input: FollowUpLetterInput): OfferLetterContent {
  const subject = `[Japan Market Report] ${input.productTitle} — Please Find Attached`;
  const customBlock = input.customNote ? `\n${input.customNote}\n` : "";

  const text = `Dear ${input.productTitle} Team,

Thank you for your time. As promised, please find below our Japan Market Analysis Report for ${input.productTitle}.

— REPORT SUMMARY —

■ Why ${input.productTitle} Will Succeed in Japan
${input.japanReasons}

■ Japan Market Overview
${input.japanMarketOverview}

■ Target Audience
${input.targetAudience}

■ Sales Strategy & Roadmap
① Crowdfunding launch on Makuake / CAMPFIRE
　（Target: ¥${input.crowdfundingTarget}）
② PR through media and influencer partnerships
③ Retail expansion on Amazon Japan and sports/specialty stores
④ B2B sales to relevant facilities and organizations

■ What We Offer
・Exclusive distribution rights management in Japan
・Support for Japanese regulatory compliance（PSE, technical standards）
・TV shopping and talent collaboration network
・Direct partnerships with Makuake and CAMPFIRE
${customBlock}
We would love to discuss this further at your convenience.
Please let us know a time that works for you.

Warm regards,

${SENDER}
${COMPANY}
${CONTACT_EMAIL}
${COMPANY_URL}`;

  const html = buildHtml(text);
  return { subject, text, html };
}

function buildHtml(text: string): string {
  const body = text
    .split("\n\n")
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  return `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; line-height: 1.7; max-width: 600px; margin: 0 auto;">
${body}
</body>
</html>`;
}
