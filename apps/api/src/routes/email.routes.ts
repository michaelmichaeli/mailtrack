import type { FastifyPluginAsync } from "fastify";
import { EmailProvider } from "@mailtrack/shared";
import { getGmailAuthUrl, exchangeGmailCode, fetchGmailEmails } from "../services/gmail.service.js";
import { parseEmail } from "../services/email-parser.service.js";
import { encrypt, decrypt } from "../lib/encryption.js";
import { detectCarrier } from "../lib/carrier-detect.js";
import { logAudit } from "../services/auth.service.js";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3003";

export const emailRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/email/connect/gmail — Redirect to Gmail OAuth consent screen
  app.get("/connect/gmail", async (request, reply) => {
    const { token } = request.query as { token?: string };

    if (!token) {
      return reply.redirect(`${WEB_URL}/settings?error=${encodeURIComponent("Authentication required")}`);
    }

    // Verify the JWT to confirm the user is logged in
    try {
      app.jwt.verify(token);
    } catch {
      return reply.redirect(`${WEB_URL}/settings?error=${encodeURIComponent("Session expired. Please log in again.")}`);
    }

    // Pass the JWT as OAuth state so callback can identify the user
    const url = getGmailAuthUrl(token);
    return reply.redirect(url);
  });

  // GET /api/email/connect/gmail/callback — Handle Gmail OAuth redirect from Google
  app.get("/connect/gmail/callback", async (request, reply) => {
    const { code, error, state } = request.query as { code?: string; error?: string; state?: string };

    if (error || !code) {
      return reply.redirect(`${WEB_URL}/settings?error=${encodeURIComponent(error ?? "Gmail connection cancelled")}`);
    }

    if (!state) {
      return reply.redirect(`${WEB_URL}/settings?error=${encodeURIComponent("Invalid session. Please try again.")}`);
    }

    // Verify the JWT from state to get userId
    let userId: string;
    try {
      const decoded = app.jwt.verify(state) as { userId: string };
      userId = decoded.userId;
    } catch {
      return reply.redirect(`${WEB_URL}/settings?error=${encodeURIComponent("Session expired. Please log in again.")}`);
    }

    try {
      const tokens = await exchangeGmailCode(code);

      if (!tokens.access_token) {
        return reply.redirect(`${WEB_URL}/settings?error=${encodeURIComponent("Failed to get Gmail access token")}`);
      }

      // Get user's email from Gmail
      const { google } = await import("googleapis");
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: tokens.access_token });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      const email = profile.data.emailAddress ?? "";

      // Store encrypted tokens
      await app.prisma.connectedEmail.upsert({
        where: { userId_email: { userId, email } },
        update: {
          accessToken: encrypt(tokens.access_token),
          refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        },
        create: {
          userId,
          provider: EmailProvider.GMAIL,
          email,
          accessToken: encrypt(tokens.access_token),
          refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        },
      });

      await logAudit(app, userId, "EMAIL_CONNECT", `Gmail: ${email}`, request.ip);

      return reply.redirect(`${WEB_URL}/settings?success=${encodeURIComponent("Gmail connected: " + email)}`);
    } catch (error: any) {
      app.log.error(error, "Gmail OAuth callback failed");
      return reply.redirect(`${WEB_URL}/settings?error=${encodeURIComponent("Failed to connect Gmail. Please try again.")}`);
    }
  });

  // POST /api/email/sync — Trigger email sync
  app.post("/sync", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;

    const connectedEmails = await app.prisma.connectedEmail.findMany({
      where: { userId },
    });

    let totalParsed = 0;
    let totalOrders = 0;

    for (const connEmail of connectedEmails) {
      if (connEmail.provider !== EmailProvider.GMAIL) continue;

      const accessToken = decrypt(connEmail.accessToken);
      const refreshToken = connEmail.refreshToken ? decrypt(connEmail.refreshToken) : null;

      const emails = await fetchGmailEmails(
        accessToken,
        refreshToken,
        connEmail.lastSyncAt ?? undefined
      );

      for (const email of emails) {
        const parsed = parseEmail(email.html, email.from, email.subject);
        totalParsed++;

        if (parsed.confidence < 0.3) continue; // Skip low confidence

        // Create or update order
        const order = await app.prisma.order.upsert({
          where: {
            id: parsed.orderId
              ? (await app.prisma.order.findFirst({
                  where: { userId, externalOrderId: parsed.orderId },
                }))?.id ?? "new"
              : "new",
          },
          update: {},
          create: {
            userId,
            shopPlatform: parsed.platform as any,
            externalOrderId: parsed.orderId,
            orderDate: parsed.orderDate ? new Date(parsed.orderDate) : null,
            merchant: parsed.merchant,
            totalAmount: parsed.totalAmount,
            currency: parsed.currency,
          },
        });

        totalOrders++;

        // Create package if tracking number found
        if (parsed.trackingNumber) {
          const existing = await app.prisma.package.findFirst({
            where: { trackingNumber: parsed.trackingNumber },
          });

          if (!existing) {
            await app.prisma.package.create({
              data: {
                orderId: order.id,
                trackingNumber: parsed.trackingNumber,
                carrier: (parsed.carrier ?? detectCarrier(parsed.trackingNumber)) as any,
                items: parsed.items.length > 0 ? JSON.stringify(parsed.items) : null,
              },
            });
          }
        }
      }

      // Update last sync time
      await app.prisma.connectedEmail.update({
        where: { id: connEmail.id },
        data: { lastSyncAt: new Date() },
      });
    }

    return {
      success: true,
      emailsParsed: totalParsed,
      ordersCreated: totalOrders,
    };
  });

  // DELETE /api/email/:id — Disconnect email
  app.delete("/:id", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;

    const email = await app.prisma.connectedEmail.findFirst({
      where: { id, userId },
    });

    if (!email) {
      return reply.status(404).send({ error: "Connected email not found" });
    }

    await app.prisma.connectedEmail.delete({ where: { id } });

    await logAudit(app, userId, "EMAIL_DISCONNECT", `${email.provider}: ${email.email}`, request.ip);

    return { success: true };
  });
};
