import type { FastifyPluginAsync } from "fastify";
import { randomBytes } from "crypto";
import { trackPackage } from "../services/tracking.service.js";

export const ingestRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/ingest/sms
   * Accepts forwarded SMS text via API key. Extracts tracking numbers and creates packages.
   * Used by phone automation (Tasker, iOS Shortcuts, IFTTT) to auto-forward shipping SMS.
   *
   * Auth: API key via ?key= query param or X-Ingest-Key header
   * Body: { text: string, source?: string }
   */
  app.post("/sms", async (request, reply) => {
    const key =
      (request.query as any)?.key ??
      (request.headers as any)["x-ingest-key"];

    if (!key) {
      return reply.status(401).send({ error: "Missing ingest key. Pass ?key= or X-Ingest-Key header." });
    }

    const user = await app.prisma.user.findFirst({ where: { ingestKey: key } });
    if (!user) {
      return reply.status(401).send({ error: "Invalid ingest key" });
    }

    const { text, source } = request.body as { text?: string; source?: string };
    if (!text?.trim()) {
      return reply.status(400).send({ error: "Missing 'text' field" });
    }

    const { extractTrackingNumbers, detectCarrier } = await import("../lib/carrier-detect.js");
    const found = extractTrackingNumbers(text);

    // Also try broader SMS patterns
    const smsPatterns = [
      /(?:tracking|shipment|parcel|package|delivery|מעקב|משלוח)\s*(?:#|number|no\.?|:)?\s*[:.]?\s*([A-Z0-9]{8,30})/gi,
    ];
    const seen = new Set(found.map((f) => f.trackingNumber));
    for (const pattern of smsPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const tn = match[1].toUpperCase();
        if (!seen.has(tn) && tn.length >= 8 && !/^\d{8,9}$/.test(tn)) {
          seen.add(tn);
          found.push({ trackingNumber: tn, carrier: detectCarrier(tn) });
        }
      }
    }

    if (found.length === 0) {
      return { success: true, added: 0, message: "No tracking numbers found in text" };
    }

    let added = 0;
    const results: Array<{ trackingNumber: string; carrier: string; status: string }> = [];

    for (const item of found) {
      // Skip if already tracked
      const existing = await app.prisma.package.findFirst({
        where: { trackingNumber: item.trackingNumber, order: { userId: user.id } },
      });
      if (existing) {
        results.push({ trackingNumber: item.trackingNumber, carrier: item.carrier, status: "already_tracked" });
        continue;
      }

      // Create order + package
      const order: any = await app.prisma.order.create({
        data: {
          userId: user.id,
          shopPlatform: "UNKNOWN",
          merchant: source ?? "SMS Auto-Forward",
          externalOrderId: `sms-${item.trackingNumber}`,
          status: "PROCESSING",
          packages: {
            create: {
              trackingNumber: item.trackingNumber,
              carrier: item.carrier,
              status: "PROCESSING",
            },
          },
        },
        include: { packages: true },
      });

      // Try to fetch tracking data
      try {
        const result = await trackPackage(item.trackingNumber, item.carrier as any);
        if (result) {
          await syncPackageFromResult(app.prisma, order.packages[0].id, result);
        }
      } catch (e) {
        app.log.error(`[ingest/sms] Error fetching tracking for ${item.trackingNumber}: ${e}`);
      }

      results.push({ trackingNumber: item.trackingNumber, carrier: item.carrier, status: "added" });
      added++;
    }

    return { success: true, added, total: found.length, results };
  });

  /**
   * POST /api/ingest/csv
   * Upload a CSV file (Amazon order history, etc.) to import orders.
   * Auth: Bearer token (normal JWT auth)
   * Body: { rows: Array<{ orderId, trackingNumber, store, items, date }> }
   */
  app.post("/csv", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;
    const { rows } = request.body as {
      rows: Array<{
        orderId?: string;
        trackingNumber?: string;
        store?: string;
        items?: string;
        date?: string;
      }>;
    };

    if (!rows?.length) {
      return { success: true, imported: 0, message: "No rows to import" };
    }

    const { detectCarrier } = await import("../lib/carrier-detect.js");
    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const tn = row.trackingNumber?.trim().toUpperCase();
      if (!tn) { skipped++; continue; }

      // Skip duplicates
      const existing = await app.prisma.package.findFirst({
        where: { trackingNumber: tn, order: { userId } },
      });
      if (existing) { skipped++; continue; }

      const carrier = detectCarrier(tn);
      const order: any = await app.prisma.order.create({
        data: {
          userId,
          shopPlatform: detectShopPlatform(row.store),
          merchant: row.store ?? "CSV Import",
          externalOrderId: row.orderId ?? `csv-${tn}`,
          orderDate: row.date ? new Date(row.date) : null,
          status: "PROCESSING",
          items: row.items ? JSON.stringify([row.items]) : null,
          packages: {
            create: {
              trackingNumber: tn,
              carrier,
              status: "PROCESSING",
              items: row.items ? JSON.stringify([row.items]) : null,
            },
          },
        },
        include: { packages: true },
      });

      // Fetch tracking
      try {
        const result = await trackPackage(tn, carrier as any);
        if (result) {
          await syncPackageFromResult(app.prisma, order.packages[0].id, result);
        }
      } catch (e) {
        // Non-fatal
      }

      imported++;
    }

    return { success: true, imported, skipped, total: rows.length };
  });

  /**
   * POST /api/ingest/generate-key
   * Generate or regenerate the user's ingest API key for SMS forwarding.
   */
  app.post("/generate-key", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;
    const key = `mt_${randomBytes(24).toString("hex")}`;

    await app.prisma.user.update({
      where: { id: userId },
      data: { ingestKey: key },
    });

    return { key };
  });

  /**
   * GET /api/ingest/key
   * Get the user's current ingest key (masked).
   */
  app.get("/key", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;
    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { ingestKey: true },
    });

    if (!user?.ingestKey) {
      return { key: null };
    }

    // Return full key so user can copy it (they need it for setup)
    return { key: user.ingestKey };
  });
};

function detectShopPlatform(store?: string): any {
  if (!store) return "UNKNOWN";
  const s = store.toUpperCase();
  if (s.includes("AMAZON")) return "AMAZON";
  if (s.includes("ALIEXPRESS")) return "ALIEXPRESS";
  if (s.includes("EBAY")) return "EBAY";
  if (s.includes("IHERB")) return "IHERB";
  if (s.includes("SHEIN")) return "SHEIN";
  if (s.includes("TEMU")) return "TEMU";
  if (s.includes("ETSY")) return "ETSY";
  if (s.includes("WALMART")) return "WALMART";
  return "UNKNOWN";
}

/** Merge carrier result into DB: update status, upsert events */
async function syncPackageFromResult(prisma: any, packageId: string, result: any) {
  await prisma.package.update({
    where: { id: packageId },
    data: {
      status: result.status as any,
      ...(result.estimatedDelivery ? { estimatedDelivery: new Date(result.estimatedDelivery) } : {}),
      ...(result.lastLocation ? { lastLocation: result.lastLocation } : {}),
    },
  });

  for (const event of result.events) {
    const eventTime = new Date(event.timestamp);
    const windowStart = new Date(eventTime.getTime() - 2000);
    const windowEnd = new Date(eventTime.getTime() + 2000);

    const exists = await prisma.trackingEvent.findFirst({
      where: {
        packageId,
        timestamp: { gte: windowStart, lte: windowEnd },
        description: event.description,
      },
    });

    if (!exists) {
      await prisma.trackingEvent.create({
        data: {
          packageId,
          timestamp: eventTime,
          location: event.location,
          status: event.status as any,
          description: event.description,
        },
      });
    }
  }
}
