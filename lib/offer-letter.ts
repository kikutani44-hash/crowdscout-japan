export interface OfferLetterInput {
  productTitle: string;
  productUrl: string;
  platform: string;
  raisedUsd: number;
  goalUsd: number;
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

  const achievementRate = input.goalUsd > 0 ? (input.raisedUsd / input.goalUsd) * 100 : 0;
  const isSuccessful = achievementRate >= 100 || input.raisedUsd >= 10_000;

  const openingLine = isSuccessful
    ? `I came across your campaign for ${input.productTitle} on ${platform} — congratulations on raising over ${raised} from ${backers} backers. ${input.productDescriptionOneLine}`
    : `I came across your campaign for ${input.productTitle} on ${platform} — your product caught my eye right away, and I wanted to reach out early while your campaign is still running. ${input.productDescriptionOneLine}`;

  const text = `Dear ${input.productTitle} Team,

${openingLine}

My name is ${SENDER}, and I represent Blink Japan, a company with deep roots in Japanese media, marketing, and consumer distribution.

I believe ${input.productTitle} has exceptional potential in Japan, where ${input.japanAppealPoint} resonates deeply with consumers.

We would love to bring ${input.productTitle} to Japan through crowdfunding platforms such as Makuake and CAMPFIRE, and we sincerely hope to be your dedicated Japan partner.

We would like to ask you to entrust the Japan sales rights for ${input.productTitle} to us. Here is what we would bring to that role:

・TV & Media Network — Our founder has over 40 years in the Japanese television industry, the last 21 of them leading Blink Japan. We maintain direct connections to home shopping networks, major broadcasters, and production companies

・Digital Marketing — Certified agency for Yahoo! Japan and Google, having managed over ¥12 billion in advertising, consistently delivering top-tier results in performance marketing

・Crowdfunding Experience — We are not approaching Makuake as a newcomer. We helped launch and grow the YouTube channel of Tomoaki Makino, a former Japan national team footballer who played in the 2018 FIFA World Cup, and we were involved in the Makuake campaign for his product. As a media company, we have also interviewed the Makuake team directly. We maintain direct relationships with Makuake and CAMPFIRE, as well as leading e-commerce channels.

As interest in Japan grows, we understand you may be receiving approaches from multiple parties. When evaluating any Japan partner, we encourage you to ask:

・Is your company legally registered in Japan, and how many years has that entity been in business?
・Can you share your company's own track record in Japan — specifically in sales, advertising, and TV/media relationships? (Not affiliated group results, but your company's results alone.)
・Are you able to introduce us directly to your contacts at Makuake or CAMPFIRE? At Blink Japan, we already have direct relationships with both platforms and can make introductions when needed.

We have been in business for 21 years as a registered Japanese corporation, and we are proud to stand behind every one of these answers.

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
  const subject = `[Japan Market Report] ${input.productTitle} — Exclusive Japan Launch Proposal`;
  const customBlock = input.customNote ? `\n${input.customNote}\n` : "";

  const text = `Dear ${input.productTitle} Team,

Thank you so much for your reply — I was genuinely delighted to hear back from you. It means a great deal to us.

As promised, please find below our Japan Market Analysis Report for ${input.productTitle}. We are very excited about the potential of your product in Japan, and we would love to be your exclusive partner to make it happen.

— JAPAN MARKET ANALYSIS REPORT —

■ Why ${input.productTitle} Will Succeed in Japan
${input.japanReasons}

■ Japan Market Overview
${input.japanMarketOverview}

■ Target Audience
${input.targetAudience}

■ Launch Strategy & Roadmap
① Crowdfunding launch on Makuake / CAMPFIRE（Japan's top crowdfunding platforms）
　（Target: ¥${input.crowdfundingTarget}）
② PR through Japanese media and influencer partnerships
③ Retail expansion on Amazon Japan and specialty stores
④ B2B sales to relevant organizations and facilities

■ What We Offer as Your Japan Partner
・Full ownership and operation of your crowdfunding campaign on Makuake / CAMPFIRE — managed entirely by Blink Japan
・Complete handling of Japanese regulatory requirements（PSE, technical certification）on your behalf
・TV shopping and influencer network
・Direct relationships with key contacts at Makuake and CAMPFIRE
・21 years of operational history as a registered Japanese corporation
${customBlock}
We would love to take this conversation to the next level. We suggest the following approach:

Step 1 — Written Exchange:
We will send you a formal partnership proposal outlining the key terms, launch timeline, and projected outcomes — so you can review everything carefully and ask any questions in writing.

Step 2 — Video Call:
Once we are aligned on the basics, we would love to connect on Zoom or Google Meet with an English-speaking member of our team to finalize the details and move forward together.

We believe this approach will give you the confidence to make the best decision for your product and your brand.

We look forward to hearing from you.

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
