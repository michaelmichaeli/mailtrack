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

        // Skip very low confidence — but keep anything plausible
        if (parsed.confidence < 0.2) continue;

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
              // Update package status if we have newer info
              const statusOrder = ["ORDERED", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];
              const currentIdx = statusOrder.indexOf(existingPkg.status);
              const newIdx = statusOrder.indexOf(parsed.status);
              if (newIdx > currentIdx) {
                updateData.status = parsed.status;
              }
            }
            // Merge items into existing package
            if (parsed.items.length > 0 && !existingPkg.items) {
              updateData.items = JSON.stringify(parsed.items);
            }
            // Save pickup location if we have it and package doesn't
            if (parsed.pickupLocation && !existingPkg.pickupLocation) {
              updateData.pickupLocation = JSON.stringify(parsed.pickupLocation);
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

      // --- Phase 2: Merge gmail- orders into real orders by item overlap ---
      // AliExpress sends "Order shipped" (has real ID + item) and "Package delivered" (has tracking + items)
      // separately. We merge them by checking if any items overlap.
      const gmailOrdersWithPkgs = await app.prisma.order.findMany({
        where: { userId, externalOrderId: { startsWith: "gmail-" }, packages: { some: {} } },
        include: { packages: true },
      });
      const realOrders = await app.prisma.order.findMany({
        where: { userId, NOT: { externalOrderId: { startsWith: "gmail-" } } },
      });

      // Helper: parse items from JSON string
      const parseItems = (s: string | null): string[] => {
        if (!s) return [];
        try { return JSON.parse(s); } catch { return []; }
      };

      // Helper: check if two item arrays overlap (fuzzy by first 20 chars)
      const itemsOverlap = (a: string[], b: string[]): boolean => {
        if (a.length === 0 || b.length === 0) return false;
        const normalize = (s: string) => s.substring(0, 15).toLowerCase().replace(/[^a-z0-9]/g, "");
        const setB = new Set(b.map(normalize));
        return a.some(item => setB.has(normalize(item)));
      };

      for (const gmailOrder of gmailOrdersWithPkgs) {
        const gmailItems = parseItems(gmailOrder.items);

        // Find a real order whose items overlap with this gmail order
        const matchingReal = realOrders.find(r => {
          const realItems = parseItems(r.items);
          return itemsOverlap(gmailItems, realItems);
        });

        if (matchingReal) {
          // Move all packages from gmail order to the real order
          for (const pkg of gmailOrder.packages) {
            await app.prisma.package.update({
              where: { id: pkg.id },
              data: { orderId: matchingReal.id },
            });
          }
          // Merge items and upgrade status on the real order
          const mergedItems = parseItems(matchingReal.items);
          for (const item of gmailItems) {
            if (!mergedItems.some(e => e === item)) mergedItems.push(item);
          }
          const updateData: Record<string, any> = {};
          if (mergedItems.length > parseItems(matchingReal.items).length) {
            updateData.items = JSON.stringify(mergedItems);
          }
          const curIdx = STATUS_ORDER.indexOf(matchingReal.status);
          const newIdx = STATUS_ORDER.indexOf(gmailOrder.status);
          if (newIdx > curIdx) updateData.status = gmailOrder.status;
          if (Object.keys(updateData).length > 0) {
            await app.prisma.order.update({ where: { id: matchingReal.id }, data: updateData });
          }
          // Delete the gmail- order
          await app.prisma.order.delete({ where: { id: gmailOrder.id } });
          continue;
        }
      }

      // --- Phase 3: Merge packageless real orders into orders that have packages (same items) ---
      // "Order shipped" emails create individual orders per item, but the package email bundles them all.
      const ordersWithPkgs = await app.prisma.order.findMany({
        where: { userId, packages: { some: {} } },
        include: { packages: true },
      });
      const ordersWithoutPkgs = await app.prisma.order.findMany({
        where: { userId, packages: { none: {} } },
      });

      for (const orphan of ordersWithoutPkgs) {
        const orphanItems = parseItems(orphan.items);
        if (orphanItems.length === 0) continue;

        // Find order with packages whose items overlap
        const match = ordersWithPkgs.find(o => {
          const oItems = parseItems(o.items).concat(o.packages.flatMap(p => parseItems(p.items)));
          return itemsOverlap(orphanItems, oItems);
        });
        if (match) {
          // Merge items from orphan into the matched order
          const matchItems = parseItems(match.items);
          for (const item of orphanItems) {
            if (!matchItems.some(e => e === item)) matchItems.push(item);
          }
          const ud: Record<string, any> = {};
          if (matchItems.length > parseItems(match.items).length) ud.items = JSON.stringify(matchItems);
          // Upgrade external ID if orphan has a real one
          if (!orphan.externalOrderId.startsWith("gmail-") && match.externalOrderId.startsWith("gmail-")) {
            ud.externalOrderId = orphan.externalOrderId;
          }
          if (Object.keys(ud).length > 0) {
            await app.prisma.order.update({ where: { id: match.id }, data: ud });
          }
          await app.prisma.order.delete({ where: { id: orphan.id } });
        }
      }

      // --- Phase 4: Group packages with same items under the same order ---
      // AliExpress assigns multiple tracking numbers to the same shipment (AE→AP→PH)
      // Group by checking if two packages on different orders share items
      const allPkgsWithOrders = await app.prisma.package.findMany({
        where: { order: { userId } },
        include: { order: true },
      });
      const pkgsByOrder = new Map<string, typeof allPkgsWithOrders>();
      for (const pkg of allPkgsWithOrders) {
        const list = pkgsByOrder.get(pkg.orderId) ?? [];
        list.push(pkg);
        pkgsByOrder.set(pkg.orderId, list);
      }

      // For each pair of orders that both have packages, merge if items overlap
      const orderIds = [...pkgsByOrder.keys()];
      const merged = new Set<string>();
      for (let i = 0; i < orderIds.length; i++) {
        if (merged.has(orderIds[i])) continue;
        const pkgsA = pkgsByOrder.get(orderIds[i])!;
        const orderA = pkgsA[0].order;
        const itemsA = parseItems(orderA.items).concat(pkgsA.flatMap(p => parseItems(p.items)));

        for (let j = i + 1; j < orderIds.length; j++) {
          if (merged.has(orderIds[j])) continue;
          const pkgsB = pkgsByOrder.get(orderIds[j])!;
          const orderB = pkgsB[0].order;
          const itemsB = parseItems(orderB.items).concat(pkgsB.flatMap(p => parseItems(p.items)));

          if (itemsOverlap(itemsA, itemsB)) {
            // Keep the order with a real ID (non-gmail) or the one with more items
            const keepA = !orderA.externalOrderId.startsWith("gmail-") || orderB.externalOrderId.startsWith("gmail-");
            const [keep, remove] = keepA ? [orderA, orderB] : [orderB, orderA];
            const removePkgs = keepA ? pkgsB : pkgsA;

            // Move packages to the kept order
            for (const pkg of removePkgs) {
              await app.prisma.package.update({ where: { id: pkg.id }, data: { orderId: keep.id } });
            }
            // Merge items & status
            const keepItems = parseItems(keep.items);
            const removeItems = parseItems(remove.items);
            for (const item of removeItems) {
              if (!keepItems.some(e => e === item)) keepItems.push(item);
            }
            const ud: Record<string, any> = {};
            if (keepItems.length > parseItems(keep.items).length) ud.items = JSON.stringify(keepItems);
            const ci = STATUS_ORDER.indexOf(keep.status);
            const ni = STATUS_ORDER.indexOf(remove.status);
            if (ni > ci) ud.status = remove.status;
            if (Object.keys(ud).length > 0) {
              await app.prisma.order.update({ where: { id: keep.id }, data: ud });
            }
            await app.prisma.order.delete({ where: { id: remove.id } });
            merged.add(remove.id);
          }
        }
      }

      // Final cleanup: delete any remaining gmail- orders with no packages
      await app.prisma.order.deleteMany({
        where: {
          userId,
          externalOrderId: { startsWith: "gmail-" },
          packages: { none: {} },
        },
      });

      // --- Phase 5: Consolidate "awaiting confirmation" orders from same checkout ---
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
        const prefix = o.externalOrderId.substring(0, 10);
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
            items: JSON.stringify([`${group.length} items from order batch ${allIds[0].substring(0, 10)}...`]),
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
