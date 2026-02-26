import type { FastifyPluginAsync } from "fastify";
import { EmailProvider } from "@mailtrack/shared";
import { getGmailAuthUrl, fetchGmailEmails } from "../services/gmail.service.js";
import { parseEmail } from "../services/email-parser.service.js";
import { decrypt } from "../lib/encryption.js";
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

    try {
      app.jwt.verify(token);
    } catch {
      return reply.redirect(`${WEB_URL}/settings?error=${encodeURIComponent("Session expired. Please log in again.")}`);
    }

    // Redirect to Google with state containing flow type + user token
    const url = getGmailAuthUrl(token);
    return reply.redirect(url);
  });

  // POST /api/email/sync — Trigger email sync
  app.post("/sync", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;
    const { full } = (request.query as { full?: string });
    const isFullSync = full === "true";

    const connectedEmails = await app.prisma.connectedEmail.findMany({
      where: { userId },
    });

    let totalParsed = 0;
    let totalOrders = 0;

    for (const connEmail of connectedEmails) {
      if (connEmail.provider !== EmailProvider.GMAIL) continue;

      try {
        const accessToken = decrypt(connEmail.accessToken);
        const refreshToken = connEmail.refreshToken ? decrypt(connEmail.refreshToken) : null;

        // If full sync requested, ignore lastSyncAt
        const since = isFullSync ? undefined : (connEmail.lastSyncAt ?? undefined);

        const emails = await fetchGmailEmails(
          accessToken,
          refreshToken,
          since
        );

      for (const email of emails) {
        const parsed = parseEmail(email.html, email.from, email.subject);
        totalParsed++;

        // Skip very low confidence — but keep anything plausible
        if (parsed.confidence < 0.2) continue;

        // Find existing order by externalOrderId or Gmail message ID
        const externalId = parsed.orderId ?? `gmail-${email.id}`;
        const existingOrder = await app.prisma.order.findFirst({
          where: { userId, externalOrderId: externalId },
        });

        let order;
        const STATUS_ORDER = ["ORDERED", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];
        if (existingOrder) {
          // Update existing order with new data (later emails may have more info)
          const updateData: Record<string, any> = {};
          // Merge items: append new items not already present
          if (parsed.items.length > 0) {
            const existing: string[] = existingOrder.items ? JSON.parse(existingOrder.items) : [];
            const merged = [...existing];
            for (const item of parsed.items) {
              if (!merged.some(e => e === item)) merged.push(item);
            }
            if (merged.length > existing.length) {
              updateData.items = JSON.stringify(merged);
            }
          }
          // Progressive status: only move forward
          if (parsed.status) {
            const curIdx = STATUS_ORDER.indexOf(existingOrder.status);
            const newIdx = STATUS_ORDER.indexOf(parsed.status);
            if (newIdx > curIdx) updateData.status = parsed.status;
          }
          if (parsed.totalAmount != null && existingOrder.totalAmount == null) {
            updateData.totalAmount = parsed.totalAmount;
            updateData.currency = parsed.currency;
          }
          if (parsed.orderDate && !existingOrder.orderDate) {
            updateData.orderDate = new Date(parsed.orderDate);
          }
          if (Object.keys(updateData).length > 0) {
            order = await app.prisma.order.update({
              where: { id: existingOrder.id },
              data: updateData,
            });
          } else {
            order = existingOrder;
          }
        } else {
          order = await app.prisma.order.create({
            data: {
              userId,
              shopPlatform: parsed.platform as any,
              externalOrderId: externalId,
              orderDate: parsed.orderDate ? new Date(parsed.orderDate) : new Date(email.date),
              merchant: parsed.merchant,
              totalAmount: parsed.totalAmount,
              currency: parsed.currency,
              items: parsed.items.length > 0 ? JSON.stringify(parsed.items) : null,
              status: (parsed.status as any) ?? "ORDERED",
            },
          });
          totalOrders++;
        }

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
                status: (parsed.status as any) ?? "ORDERED",
                items: parsed.items.length > 0 ? JSON.stringify(parsed.items) : null,
              },
            });
          } else if (parsed.status) {
            // Update package status if we have newer info
            const statusOrder = ["ORDERED", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];
            const currentIdx = statusOrder.indexOf(existing.status);
            const newIdx = statusOrder.indexOf(parsed.status);
            if (newIdx > currentIdx) {
              await app.prisma.package.update({
                where: { id: existing.id },
                data: { status: parsed.status as any },
              });
            }
          }
        }
      }

      // Update last sync time
      await app.prisma.connectedEmail.update({
        where: { id: connEmail.id },
        data: { lastSyncAt: new Date() },
      });
      } catch (err: any) {
        app.log.error({ err: err.message, emailId: connEmail.id }, "Failed to sync email account");
      }
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
