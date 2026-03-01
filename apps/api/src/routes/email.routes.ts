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

      const STATUS_ORDER = ["ORDERED", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];

      for (const email of emails) {
        const parsed = parseEmail(email.html, email.from, email.subject);
        totalParsed++;

        // No tracking number = no actionable data for the user. Skip.
        if (!parsed.trackingNumber) continue;

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
          // Upgrade merchant if currently unknown
          if (parsed.merchant && (!existingOrder.merchant || existingOrder.merchant === "Unknown")) {
            updateData.merchant = parsed.merchant;
          }
          // Upgrade platform if currently unknown
          if (parsed.platform && parsed.platform !== "UNKNOWN" && existingOrder.shopPlatform === "UNKNOWN") {
            updateData.shopPlatform = parsed.platform;
          }
          // If the existing order has a gmail- ID but we now have a real order ID, upgrade it
          if (parsed.orderId && existingOrder.externalOrderId?.startsWith("gmail-")) {
            updateData.externalOrderId = parsed.orderId;
          }
          if (Object.keys(updateData).length > 0) {
            order = await app.prisma.order.update({
              where: { id: existingOrder.id },
              data: updateData,
            });
            // Create notification for status change
            if (updateData.status) {
              const itemName = parsed.items[0] || parsed.trackingNumber || "Package";
              const STATUS_ICONS: Record<string, string> = {
                SHIPPED: "📤", IN_TRANSIT: "🚚", OUT_FOR_DELIVERY: "📬",
                DELIVERED: "✅", EXCEPTION: "⚠️", RETURNED: "↩️",
              };
              const STATUS_LABELS: Record<string, string> = {
                SHIPPED: "Shipped", IN_TRANSIT: "In Transit", OUT_FOR_DELIVERY: "Out for Delivery",
                DELIVERED: "Delivered", EXCEPTION: "Exception", RETURNED: "Returned",
              };
              await app.prisma.notification.create({
                data: {
                  userId,
                  type: updateData.status === "DELIVERED" ? "DELIVERY" : "STATUS_CHANGE",
                  title: updateData.status === "DELIVERED" ? "Package Delivered! 🎉" : `Tracking Update`,
                  body: `${itemName} — ${STATUS_LABELS[updateData.status] ?? updateData.status}`,
                  icon: STATUS_ICONS[updateData.status] ?? "📦",
                  orderId: existingOrder.id,
                },
              });
            }
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

          // Create notification for new order
          const itemName = parsed.items[0] || parsed.trackingNumber || "New package";
          await app.prisma.notification.create({
            data: {
              userId,
              type: "NEW_ORDER",
              title: "New Order Detected",
              body: `${itemName}${parsed.merchant ? ` from ${parsed.merchant}` : ""}`,
              icon: "🛍️",
              orderId: order.id,
            },
          });
        }

        // Create or update package if tracking number found
        if (parsed.trackingNumber) {
          if (!existingPkg) {
            // Re-check in case another email in this batch already created it
            existingPkg = await app.prisma.package.findFirst({
              where: { trackingNumber: parsed.trackingNumber },
            });
          }

          let packageId: string;

          if (!existingPkg) {
            const newPkg = await app.prisma.package.create({
              data: {
                orderId: order.id,
                trackingNumber: parsed.trackingNumber,
                carrier: (parsed.carrier ?? detectCarrier(parsed.trackingNumber)) as any,
                status: (parsed.status as any) ?? "ORDERED",
                items: parsed.items.length > 0 ? JSON.stringify(parsed.items) : null,
                pickupLocation: parsed.pickupLocation ? JSON.stringify(parsed.pickupLocation) : null,
              },
            });
            packageId = newPkg.id;
          } else {
            packageId = existingPkg.id;
            const updateData: any = {};
            if (parsed.status) {
              const statusOrder = ["ORDERED", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];
              const currentIdx = statusOrder.indexOf(existingPkg.status);
              const newIdx = statusOrder.indexOf(parsed.status);
              if (newIdx > currentIdx) {
                updateData.status = parsed.status;
              }
            }
            // Merge items: append new items not already present
            if (parsed.items.length > 0) {
              const existing: string[] = existingPkg.items ? JSON.parse(existingPkg.items) : [];
              const merged = [...existing];
              for (const item of parsed.items) {
                if (!merged.some(e => e === item)) merged.push(item);
              }
              if (merged.length > existing.length) {
                updateData.items = JSON.stringify(merged);
              }
            }
            // Update pickup location if we have newer/better data
            if (parsed.pickupLocation) {
              updateData.pickupLocation = JSON.stringify(parsed.pickupLocation);
            }
            // Update carrier if currently UNKNOWN and we now have a match
            if (existingPkg.carrier === "UNKNOWN" && parsed.carrier && parsed.carrier !== "UNKNOWN") {
              updateData.carrier = parsed.carrier;
            }
            if (Object.keys(updateData).length > 0) {
              await app.prisma.package.update({
                where: { id: existingPkg.id },
                data: updateData,
              });
            }
          }

          // Create tracking event from this email (each email = a status update)
          if (parsed.status) {
            const eventDate = new Date(email.date);
            const statusDescriptions: Record<string, string> = {
              ORDERED: "Order placed",
              PROCESSING: "Package is being prepared for shipment",
              SHIPPED: "Package has been shipped",
              IN_TRANSIT: "Package is in transit",
              OUT_FOR_DELIVERY: "Package is ready for pickup / out for delivery",
              DELIVERED: "Package has been delivered",
            };
            const desc = statusDescriptions[parsed.status] ?? parsed.status;
            // Avoid duplicate events (same package, same status, within 1 hour)
            const existingEvent = await app.prisma.trackingEvent.findFirst({
              where: {
                packageId,
                status: parsed.status as any,
                timestamp: {
                  gte: new Date(eventDate.getTime() - 3600000),
                  lte: new Date(eventDate.getTime() + 3600000),
                },
              },
            });
            if (!existingEvent) {
              await app.prisma.trackingEvent.create({
                data: {
                  packageId,
                  timestamp: eventDate,
                  status: parsed.status as any,
                  description: desc,
                  location: null,
                },
              });
            }
          }
        }
      }

      // --- Phase 2: Clean up packageless gmail- orders ---
      // Gmail- orders without any tracking data are not useful to the user
      await app.prisma.order.deleteMany({
        where: {
          userId,
          externalOrderId: { startsWith: "gmail-" },
          packages: { none: {} },
        },
      });

      // --- Phase 3: Consolidate "awaiting confirmation" orders from same checkout ---
      // AliExpress sends separate "awaiting confirmation" emails per item in a checkout.
      // These create many orders with sequential IDs (same 10-digit prefix), no items, no tracking.
      // Group them into one order per checkout batch.
      const emptyOrders = await app.prisma.order.findMany({
        where: {
          userId,
          packages: { none: {} },
          NOT: { externalOrderId: { startsWith: "gmail-" } },
        },
        orderBy: { externalOrderId: "asc" },
      });

      // Group by first 10 chars of externalOrderId
      const prefixGroups = new Map<string, typeof emptyOrders>();
      for (const o of emptyOrders) {
        const prefix = o.externalOrderId?.substring(0, 10) ?? "";
        const list = prefixGroups.get(prefix) ?? [];
        list.push(o);
        prefixGroups.set(prefix, list);
      }

      for (const [, group] of prefixGroups) {
        if (group.length <= 1) continue;
        // Keep the first order, delete the rest
        const [keep, ...rest] = group;
        // Update the kept order to indicate it represents multiple items
        const allIds = group.map(o => o.externalOrderId);
        await app.prisma.order.update({
          where: { id: keep.id },
          data: {
            items: JSON.stringify([`${group.length} items from order batch ${allIds[0]?.substring(0, 10) ?? ""}...`]),
          },
        });
        for (const dup of rest) {
          await app.prisma.order.delete({ where: { id: dup.id } });
        }
      }

      // Update last sync time
      await app.prisma.connectedEmail.update({
        where: { id: connEmail.id },
        data: { lastSyncAt: new Date() },
      });
      } catch (err: any) {
        console.error("[email-sync] Failed:", err.message, err.stack?.split('\n')[1]);
        app.log.error({ err: err.message, emailId: connEmail.id }, "Failed to sync email account");
      }
    }

    // Get final counts after merge
    const finalCount = await app.prisma.order.count({ where: { userId: (request as any).user.userId } });
    const trackingCount = await app.prisma.package.count({ where: { order: { userId: (request as any).user.userId } } });

    return {
      success: true,
      emailsParsed: totalParsed,
      ordersCreated: totalOrders,
      totalOrders: finalCount,
      totalTracking: trackingCount,
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
