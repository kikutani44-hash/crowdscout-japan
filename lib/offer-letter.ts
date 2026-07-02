export interface OfferLetterInput {
  productTitle: string;
  productUrl: string;
  raisedUsd: number;
  backers: number;
  category?: string;
  customNote?: string;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
