import sgMail from "@sendgrid/mail";
import { buildOfferLetter, type OfferLetterInput } from "./offer-letter";

const fromEmail = process.env.FROM_EMAIL ?? "kikuya@blinkjapan.co.jp";
const fromName = process.env.FROM_NAME ?? "Blink Japan Co., Ltd.";

export interface OfferLetterParams extends OfferLetterInput {
  to: string;
}

export interface SendOfferResult {
  demo: boolean;
  to: string;
  subject: string;
}

export function isSendGridConfigured(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY && fromEmail);
}

export async function sendOfferLetter(params: OfferLetterParams): Promise<SendOfferResult> {
  const letter = buildOfferLetter(params);

  if (!isSendGridConfigured()) {
    console.log("[mailer demo]", {
      to: params.to,
      subject: letter.subject,
      productTitle: params.productTitle,
    });
    return { demo: true, to: params.to, subject: letter.subject };
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

  await sgMail.send({
    to: params.to,
    from: { email: fromEmail, name: fromName },
    subject: letter.subject,
    text: letter.text,
    html: letter.html,
    replyTo: fromEmail,
  });

  return { demo: false, to: params.to, subject: letter.subject };
}

export function previewOfferLetter(params: OfferLetterInput) {
  return buildOfferLetter(params);
}
