export interface OfferLetterInput {
  productTitle: string;
  productUrl: string;
  raisedUsd: number;
  backers: number;
  category?: string;
  customNote?: string;
  subtitle?: string;
  description?: string;
}

export interface FollowUpLetterInput {
  productTitle: string;
  productUrl: string;
  raisedUsd: number;
  backers: number;
  category?: string;
  customNote?: string;
  // Japan market report data to include
  whySellsInJapan?: string;
  marketOverview?: string;
  salesStrategy?: string;
}

export interface OfferLetterContent {
  subject: string;
  text: string;
  html: string;
}

const COMPANY = "Blink Japan Co., Ltd.";
const CONTACT_EMAIL = "cbec@blink-japan.com";
const COMPANY_URL = "https://blink-japan.com/";

// 1通目: 返信を引き出すための短いフックメール
// 「日本市場レポートを用意した」というフックで返信を引き出し、
// 返信後または未返信の2通目にて提案書(market-report)を送付する
export function buildOfferLetter(input: OfferLetterInput): OfferLetterContent {
  const subject = `${input.productTitle} — Japan Launch Opportunity`;
  const achievement = `$${input.raisedUsd.toLocaleString("en-US")} from ${input.backers.toLocaleString()} backers`;

  const customBlock = input.customNote ? `\n${input.customNote}\n` : "";

  const text = `Hi,

I came across your "${input.productTitle}" campaign${input.category ? ` in the ${input.category} category` : ""} — raising ${achievement} is a remarkable achievement, and the product genuinely caught my attention.

I'm reaching out from ${COMPANY}, a Japan-based firm that specializes in bringing successful crowdfunding products to the Japanese market through exclusive partnerships on platforms like Makuake, CAMPFIRE, and Green Funding, as well as retail channels.

Japan has a strong appetite for innovative products like yours, and I've put together a brief market analysis showing how "${input.productTitle}" could perform here. Would you be open to taking a look?
${customBlock}
Best regards,
[Your Name]
${COMPANY}
${CONTACT_EMAIL}
${COMPANY_URL}

Campaign: ${input.productUrl}`;

  const html = `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; line-height: 1.7; max-width: 600px; margin: 0 auto;">
  <p>Hi,</p>
  <p>
    I came across your <strong>${escapeHtml(input.productTitle)}</strong> campaign${input.category ? ` in the ${escapeHtml(input.category)} category` : ""} —
    raising <strong>${escapeHtml(achievement)}</strong> is a remarkable achievement, and the product genuinely caught my attention.
  </p>
  <p>
    I'm reaching out from <strong>${COMPANY}</strong>, a Japan-based firm that specializes in bringing successful
    crowdfunding products to the Japanese market through exclusive partnerships on platforms like
    Makuake, CAMPFIRE, and Green Funding, as well as retail channels.
  </p>
  <p>
    Japan has a strong appetite for innovative products like yours, and I've put together a brief
    market analysis showing how <strong>${escapeHtml(input.productTitle)}</strong> could perform here.
    Would you be open to taking a look?
  </p>
  ${input.customNote ? `<p>${escapeHtml(input.customNote).replace(/\n/g, "<br>")}</p>` : ""}
  <p>
    Best regards,<br>
    [Your Name]<br>
    <strong>${COMPANY}</strong><br>
    <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a><br>
    <a href="${escapeHtml(COMPANY_URL)}">${escapeHtml(COMPANY_URL)}</a>
  </p>
  <p style="color:#9ca3af;font-size:12px;">
    Campaign: <a href="${escapeHtml(input.productUrl)}" style="color:#6b7280;">${escapeHtml(input.productUrl)}</a>
  </p>
</body>
</html>`;

  return { subject, text, html };
}

// 2通目: 日本市場レポートを提示するフォローアップメール
export function buildFollowUpLetter(input: FollowUpLetterInput): OfferLetterContent {
  const subject = `Re: ${input.productTitle} — Japan Market Analysis Inside`;
  const achievement = `$${input.raisedUsd.toLocaleString("en-US")} from ${input.backers.toLocaleString()} backers`;

  const customBlock = input.customNote ? `\n${input.customNote}\n` : "";

  const reportSection = input.whySellsInJapan
    ? `\n--- Japan Market Highlights for ${input.productTitle} ---\n\n${input.whySellsInJapan}${input.marketOverview ? "\n\nMarket Overview:\n" + input.marketOverview : ""}${input.salesStrategy ? "\n\nProposed Strategy:\n" + input.salesStrategy : ""}\n---\n`
    : "";

  const text = `Hi,

I wanted to follow up on my previous message about bringing "${input.productTitle}" to the Japanese market.

With ${achievement}, this campaign has demonstrated exceptional market validation. I genuinely believe Japan represents your next major growth opportunity.

To give you a concrete sense of the potential, I've prepared a brief Japan market analysis specifically for ${input.productTitle}:
${reportSection}
Here's what we can offer:
- Exclusive Japan distribution rights (Makuake, CAMPFIRE, and Green Funding launch)
- Full localization and Japanese customer support
- Retail channel introduction (major electronics stores, lifestyle retailers)
- Zero upfront cost to you — we handle all Japan-side logistics
${customBlock}
Would you have 20 minutes for a quick call this week? I'd love to walk you through the analysis and explore whether this could be a great fit.

Best regards,
Yoshitaka Kikutani
${COMPANY}
${CONTACT_EMAIL}
${COMPANY_URL}

Campaign: ${input.productUrl}`;

  const html = `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; line-height: 1.7; max-width: 600px; margin: 0 auto;">
  <p>Hi,</p>
  <p>I wanted to follow up on my previous message about bringing <strong>${escapeHtml(input.productTitle)}</strong> to the Japanese market.</p>
  <p>With <strong>${escapeHtml(achievement)}</strong>, this campaign has demonstrated exceptional market validation. I genuinely believe Japan represents your next major growth opportunity.</p>
  <p>To give you a concrete sense of the potential, I've prepared a brief Japan market analysis specifically for <strong>${escapeHtml(input.productTitle)}</strong>:</p>
  ${input.whySellsInJapan ? `
  <div style="background:#f8f9fa;border-left:4px solid #3b82f6;padding:16px;margin:16px 0;border-radius:4px;">
    <p style="font-weight:bold;margin-top:0;">🇯🇵 Japan Market Analysis</p>
    ${input.whySellsInJapan ? `<p><strong>Why it will sell in Japan:</strong><br>${escapeHtml(input.whySellsInJapan).replace(/\n/g, "<br>")}</p>` : ""}
    ${input.marketOverview ? `<p><strong>Market Overview:</strong><br>${escapeHtml(input.marketOverview).replace(/\n/g, "<br>")}</p>` : ""}
    ${input.salesStrategy ? `<p><strong>Proposed Strategy:</strong><br>${escapeHtml(input.salesStrategy).replace(/\n/g, "<br>")}</p>` : ""}
  </div>` : ""}
  <p><strong>Here's what we can offer:</strong></p>
  <ul>
    <li>Exclusive Japan distribution rights (Makuake, CAMPFIRE, and Green Funding launch)</li>
    <li>Full localization and Japanese customer support</li>
    <li>Retail channel introduction (major electronics stores, lifestyle retailers)</li>
    <li>Zero upfront cost to you — we handle all Japan-side logistics</li>
  </ul>
  ${input.customNote ? `<p>${escapeHtml(input.customNote).replace(/\n/g, "<br>")}</p>` : ""}
  <p>Would you have 20 minutes for a quick call this week? I'd love to walk you through the analysis and explore whether this could be a great fit.</p>
  <p>
    Best regards,<br>
    Yoshitaka Kikutani<br>
    <strong>${COMPANY}</strong><br>
    <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a><br>
    <a href="${escapeHtml(COMPANY_URL)}">${escapeHtml(COMPANY_URL)}</a>
  </p>
  <p style="color:#9ca3af;font-size:12px;">
    Campaign: <a href="${escapeHtml(input.productUrl)}" style="color:#6b7280;">${escapeHtml(input.productUrl)}</a>
  </p>
</body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
