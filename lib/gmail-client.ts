import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";
const REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI ??
  "http://localhost:3000/api/gmail/callback";

export function createOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthUrl(): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.labels",
    ],
  });
}

export function isGmailConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);
}

export async function getAuthorizedGmail() {
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: "v1", auth: client });
}

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body?: string;
  isReply: boolean; // true = maker → us, false = us → maker
}

export interface GmailThread {
  threadId: string;
  makerEmail: string;
  messages: GmailMessage[];
  lastDate: string;
  hasReply: boolean;
}

function decodeBase64(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = Buffer.from(base64, "base64").toString("utf-8");
  return decoded;
}

function extractHeader(
  headers: Array<{ name?: string | null; value?: string | null }>,
  name: string
): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractTextBody(payload: {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: Array<{ mimeType?: string | null; body?: { data?: string | null } | null; parts?: unknown[] }> | null;
}): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64(part.body.data);
      }
    }
  }
  return "";
}

export async function searchThreadsForEmail(
  makerEmail: string
): Promise<GmailThread | null> {
  const gmail = await getAuthorizedGmail();
  const fromEmail = process.env.FROM_EMAIL ?? "kikuya@blinkjapan.co.jp";

  const query = `(from:${makerEmail} OR to:${makerEmail})`;

  const res = await gmail.users.threads.list({
    userId: "me",
    q: query,
    maxResults: 20,
  });

  const threads = res.data.threads ?? [];
  if (threads.length === 0) return null;

  // Get details of the most recent thread
  const threadId = threads[0].id!;
  const threadDetail = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });

  const messages: GmailMessage[] = (threadDetail.data.messages ?? []).map((msg) => {
    const headers = msg.payload?.headers ?? [];
    const from = extractHeader(headers, "from");
    const to = extractHeader(headers, "to");
    const subject = extractHeader(headers, "subject");
    const date = extractHeader(headers, "date");

    const isFromMaker = from.includes(makerEmail);

    return {
      id: msg.id!,
      threadId: threadId,
      subject,
      from,
      to,
      date,
      snippet: msg.snippet ?? "",
      body: extractTextBody(msg.payload ?? {}),
      isReply: isFromMaker,
    };
  });

  const hasReply = messages.some((m) => m.isReply);

  return {
    threadId,
    makerEmail,
    messages,
    lastDate: messages[messages.length - 1]?.date ?? "",
    hasReply,
  };
}

export async function searchAllOfferThreads(
  makerEmails: string[]
): Promise<GmailThread[]> {
  if (makerEmails.length === 0) return [];

  // Search all at once
  const gmail = await getAuthorizedGmail();
  const query = makerEmails
    .slice(0, 50)
    .map((e) => `(from:${e} OR to:${e})`)
    .join(" OR ");

  const res = await gmail.users.threads.list({
    userId: "me",
    q: query,
    maxResults: 100,
  });

  const threadRefs = res.data.threads ?? [];
  const results: GmailThread[] = [];

  for (const ref of threadRefs.slice(0, 30)) {
    try {
      const detail = await gmail.users.threads.get({
        userId: "me",
        id: ref.id!,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"],
      });

      const messages = (detail.data.messages ?? []).map((msg) => {
        const headers = msg.payload?.headers ?? [];
        const from = extractHeader(headers, "from");
        const to = extractHeader(headers, "to");
        const subject = extractHeader(headers, "subject");
        const date = extractHeader(headers, "date");

        const matchedEmail = makerEmails.find(
          (e) => from.includes(e) || to.includes(e)
        );
        const isFromMaker = matchedEmail ? from.includes(matchedEmail) : false;

        return {
          id: msg.id!,
          threadId: ref.id!,
          subject,
          from,
          to,
          date,
          snippet: msg.snippet ?? "",
          isReply: isFromMaker,
        } as GmailMessage;
      });

      const makerEmail =
        makerEmails.find((e) =>
          messages.some((m) => m.from.includes(e) || m.to.includes(e))
        ) ?? "";

      results.push({
        threadId: ref.id!,
        makerEmail,
        messages,
        lastDate: messages[messages.length - 1]?.date ?? "",
        hasReply: messages.some((m) => m.isReply),
      });
    } catch {
      // skip thread if fetch fails
    }
  }

  return results;
}
