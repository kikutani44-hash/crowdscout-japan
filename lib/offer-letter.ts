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
const CONTACT_EMAIL = "kikuya@blinkjapan.co.jp";

const COMPANY_CREDENTIALS = [
  "TV program production & TV shopping network connections",
  "Talent collaboration & co-developed product campaigns",
  "Established crowdfunding platform partnerships in Japan",
] as const;

function credentialsText(): string {
  return COMPANY_CREDENTIALS.map((item) => `- ${item}`).join("\n");
}

function credentialsHtml(): string {
  return `<ul>${COMPANY_CREDENTIALS.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function buildOfferLetter(input: OfferLetterInput): OfferLetterContent {
  const subject = `Partnership Opportunity – ${input.productTitle} in Japan`;
  const achievement = `$${input.raisedUsd.toLocaleString("en-US")} from ${input.backers.toLocaleString("en-US")} backers`;

  const customBlock = input.customNote
    ? `\n\nAdditional note:\n${input.customNote}\n`
    : "";

  const text = `Dear Partner,

We are ${COMPANY}, a Japan-based company specializing in bringing successful overseas crowdfunding products to the Japanese market.

Our strengths include:
${credentialsText()}

We were impressed by your campaign "${input.productTitle}", which raised ${achievement}. We believe this product has strong potential in Japan${input.category ? `, particularly in the ${input.category} category` : ""}.

We would like to discuss exclusive distribution and localization partnership rights in Japan, including:
- Exclusive or semi-exclusive retail/distribution in Japan
- Regulatory support (PSE, radio law / technical compliance)
- Marketing and launch on Japanese crowdfunding platforms (Makuake, GREEN FUNDING, CAMPFIRE)

Campaign: ${input.productUrl}
${customBlock}
We would welcome a brief call to explore collaboration.

Best regards,
${COMPANY}
${CONTACT_EMAIL}
https://blinkjapan.co.jp`;

  const html = `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; line-height: 1.6; max-width: 640px;">
  <p>Dear Partner,</p>
  <p>
    We are <strong>${COMPANY}</strong>, a Japan-based company specializing in bringing
    successful overseas crowdfunding products to the Japanese market.
  </p>
  <p>Our strengths include:</p>
  ${credentialsHtml()}
  <p>
    We were impressed by your campaign
    <strong>${escapeHtml(input.productTitle)}</strong>, which raised
    <strong>${escapeHtml(achievement)}</strong>.
    We believe this product has strong potential in Japan${input.category ? `, particularly in the <strong>${escapeHtml(input.category)}</strong> category` : ""}.
  </p>
  <p>We would like to discuss exclusive distribution and localization partnership rights in Japan, including:</p>
  <ul>
    <li>Exclusive or semi-exclusive retail/distribution in Japan</li>
    <li>Regulatory support (PSE, radio law / technical compliance)</li>
    <li>Marketing and launch on Japanese crowdfunding platforms (Makuake, GREEN FUNDING, CAMPFIRE)</li>
  </ul>
  <p>Campaign: <a href="${escapeHtml(input.productUrl)}">${escapeHtml(input.productUrl)}</a></p>
  ${input.customNote ? `<p><strong>Additional note:</strong><br>${escapeHtml(input.customNote).replace(/\n/g, "<br>")}</p>` : ""}
  <p>We would welcome a brief call to explore collaboration.</p>
  <p>
    Best regards,<br>
    <strong>${COMPANY}</strong><br>
    <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
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
