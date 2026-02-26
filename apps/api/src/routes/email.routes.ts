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

  // GET /api/email/debug-emails — Fetch and show raw parsed emails (dev only)
  app.get("/debug-emails", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;
    const connectedEmails = await app.prisma.connectedEmail.findMany({ where: { userId } });
    const results: any[] = [];

    for (const connEmail of connectedEmails) {
      if (connEmail.provider !== EmailProvider.GMAIL) continue;
      const accessToken = decrypt(connEmail.accessToken);
      const refreshToken = connEmail.refreshToken ? decrypt(connEmail.refreshToken) : null;
      const emails = await fetchGmailEmails(accessToken, refreshToken);

      for (const email of emails) {
        const parsed = parseEmail(email.html, email.from, email.subject);
        results.push({
          gmailId: email.id,
          subject: email.subject,
          from: email.from,
          date: email.date,
          parsed: {
            orderId: parsed.orderId,
            merchant: parsed.merchant,
            platform: parsed.platform,
            trackingNumber: parsed.trackingNumber,
            carrier: parsed.carrier,
            status: parsed.status,
            items: parsed.items,
            totalAmount: parsed.totalAmount,
            confidence: parsed.confidence,
          },
        });
      }
    }

    return { total: results.length, emails: results };
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

        const STATUS_ORDER = ["ORDERED", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];

        // --- Order resolution: find the right order to attach this email to ---
        const externalId = parsed.orderId ?? `gmail-${email.id}`;

        // 1. Try by externalOrderId first
        let existingOrder = await app.prisma.order.findFirst({
          where: { userId, externalOrderId: externalId },
        });

        // 2. If we have a tracking number, check if a package with it already exists
        //    and merge into that order (avoids duplicates from shipped + delivered emails)
        let existingPkg: any = null;
        if (parsed.trackingNumber) {
          existingPkg = await app.prisma.package.findFirst({
            where: { trackingNumber: parsed.trackingNumber },
            include: { order: true },
          });
          if (existingPkg && !existingOrder) {
            // Merge into the order that owns this tracking number
            existingOrder = existingPkg.order;
          }
        }

        let order;
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
          // If the existing order has a gmail- ID but we now have a real order ID, upgrade it
          if (parsed.orderId && existingOrder.externalOrderId.startsWith("gmail-")) {
            updateData.externalOrderId = parsed.orderId;
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

        // Create or update package if tracking number found
        if (parsed.trackingNumber) {
          if (!existingPkg) {
            // Re-check in case another email in this batch already created it
            existingPkg = await app.prisma.package.findFirst({
              where: { trackingNumber: parsed.trackingNumber },
            });
          }

          if (!existingPkg) {
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
            const currentIdx = statusOrder.indexOf(existingPkg.status);
            const newIdx = statusOrder.indexOf(parsed.status);
            if (newIdx > currentIdx) {
              await app.prisma.package.update({
                where: { id: existingPkg.id },
                data: { status: parsed.status as any },
              });
            }
            // Merge items into existing package
            if (parsed.items.length > 0 && !existingPkg.items) {
              await app.prisma.package.update({
                where: { id: existingPkg.id },
                data: { items: JSON.stringify(parsed.items) },
              });
            }
          }
        }
      }

      // Clean up orphaned gmail- orders that have no packages and duplicate a real order's data
      // (e.g., "delivered" email created gmail-xxx order, but tracking was merged into real order)
      const orphanedGmailOrders = await app.prisma.order.findMany({
        where: {
          userId,
          externalOrderId: { startsWith: "gmail-" },
          packages: { none: {} },
        },
      });
      for (const orphan of orphanedGmailOrders) {
        // Delete if there's a "real" order with same items/merchant
        const realOrder = await app.prisma.order.findFirst({
          where: {
            userId,
            id: { not: orphan.id },
            merchant: orphan.merchant,
            NOT: { externalOrderId: { startsWith: "gmail-" } },
          },
        });
        if (realOrder) {
          await app.prisma.order.delete({ where: { id: orphan.id } });
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
