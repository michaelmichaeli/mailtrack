import { google } from "googleapis";
import type { FastifyInstance } from "fastify";
import { decrypt } from "../lib/encryption.js";

const API_URL = process.env.API_URL ?? "http://localhost:3002";
const GMAIL_REDIRECT_URI = `${API_URL}/api/auth/google/callback`;
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    GMAIL_REDIRECT_URI
  );
}

/**
 * Get Gmail OAuth2 URL for user authorization.
 * State encodes the flow type and user token as JSON.
 */
export function getGmailAuthUrl(userToken: string): string {
  const oauth2Client = getOAuth2Client();
  const state = JSON.stringify({ flow: "gmail", token: userToken });

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state,
  });
}

/**
 * Exchange Gmail auth code for tokens.
 */
export async function exchangeGmailCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Fetch shipping/order emails from Gmail.
 */
export async function fetchGmailEmails(
  accessToken: string,
  refreshToken: string | null,
  since?: Date
) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Broad scan: search subject + body for shipping keywords, OR from known senders.
  // The downstream filter (must have tracking number) discards irrelevant matches.
  let query =
    'subject:(shipping OR tracking OR shipped OR delivered OR dispatched OR shipment OR parcel OR package OR delivery OR order OR courier OR "out for delivery" OR "has shipped" OR "order shipped" OR "ready for collection" OR "awaiting collection" OR חבילה OR משלוח OR נשלח OR הזמנה)' +
    ' OR from:aliexpress OR from:cainiao OR from:amazon OR from:ebay OR from:etsy OR from:shein OR from:temu' +
    ' OR from:walmart OR from:iherb OR from:shopify OR from:banggood OR from:parcelhome' +
    ' OR from:fedex OR from:ups OR from:dhl OR from:usps OR from:aramex' +
    ' OR from:yanwen OR from:postnl OR from:zara OR from:asos';

  if (since) {
    const afterDate = Math.floor(since.getTime() / 1000);
    query = `(${query}) after:${afterDate}`;
  }

  // Paginate through ALL matching messages
  const allMessageIds: Array<{ id: string }> = [];
  let pageToken: string | undefined;
  do {
    const listResponse = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 500,
      pageToken,
    });
    const messages = listResponse.data.messages ?? [];
    for (const m of messages) {
      if (m.id) allMessageIds.push({ id: m.id });
    }
    pageToken = listResponse.data.nextPageToken ?? undefined;
  } while (pageToken);

  console.log(`[gmail] Query matched ${allMessageIds.length} emails`);

  const emails: Array<{ id: string; html: string; from: string; subject: string; date: string }> = [];

  // Fetch each message (batch in groups of 20 to avoid rate limits)
  const BATCH_SIZE = 20;
  for (let i = 0; i < allMessageIds.length; i += BATCH_SIZE) {
    const batch = allMessageIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (msg) => {
        try {
          const msgResponse = await gmail.users.messages.get({
            userId: "me",
            id: msg.id,
            format: "full",
          });

          const headers = msgResponse.data.payload?.headers ?? [];
          const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
          const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
          const date = headers.find((h) => h.name?.toLowerCase() === "date")?.value ?? "";

          const html = extractHtmlBody(msgResponse.data.payload);
          const text = html ? null : extractTextBody(msgResponse.data.payload);
          const body = html ?? (text ? `<pre>${text}</pre>` : null);

          if (body) {
            return { id: msg.id, html: body, from, subject, date };
          }
        } catch {
          // Skip messages that fail to fetch
        }
        return null;
      })
    );
    for (const r of results) {
      if (r) emails.push(r);
    }
  }

  return emails;
}

function extractHtmlBody(payload: any): string | null {
  if (!payload) return null;

  // Check this part
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  // Check parts recursively
  if (payload.parts) {
    for (const part of payload.parts) {
      const html = extractHtmlBody(part);
      if (html) return html;
    }
  }

  return null;
}

function extractTextBody(payload: any): string | null {
  if (!payload) return null;

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractTextBody(part);
      if (text) return text;
    }
  }

  return null;
}

/**
 * Set up Gmail push notifications via Pub/Sub.
 */
export async function setupGmailWatch(accessToken: string, refreshToken: string | null) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Set up push notification to our webhook endpoint
  const response = await gmail.users.watch({
    userId: "me",
    requestBody: {
      labelIds: ["INBOX"],
      topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/topics/gmail-notifications`,
    },
  });

  return response.data;
}
