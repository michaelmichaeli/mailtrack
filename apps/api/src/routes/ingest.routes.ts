import type { FastifyPluginAsync } from "fastify";
import { randomBytes } from "crypto";
import { trackPackage } from "../services/tracking.service.js";
import { syncPackageFromResult } from "../services/package-sync.service.js";
import { notifyStatusChange } from "../services/notification.service.js";

/** Parse pickup location info from delivery SMS (Cheetah, Israel Post, etc.) */
function parseSmsPickupInfo(text: string): {
  storeName?: string;
  address?: string;
  hours?: string;
  shelf?: string;
  pickupUrl?: string;
} | null {
  const info: Record<string, string> = {};

  // Cheetah format: "בחנות [store],[address].פרטים:[details]. ימים [hours] והמשלוח..."
  const cheetahMatch = text.match(/בחנות\s+(.+?),\s*\*?([^,*]+)\*?\s*(\d+)\s+([^,]+)/);
  if (cheetahMatch) {
    info.storeName = cheetahMatch[1].trim();
    info.address = `${cheetahMatch[2].trim()} ${cheetahMatch[3]}, ${cheetahMatch[4].trim()}`;
  }

  // Broader store name pattern
  if (!info.storeName) {
    const storeMatch = text.match(/בחנות\s+([^,\n]+)/);
    if (storeMatch) info.storeName = storeMatch[1].trim();
  }

  // Address pattern: street + number + city
  if (!info.address) {
    const addrMatch = text.match(/\*([^*]+)\*\s*(\d+)\s+([^,\n.]+)/);
    if (addrMatch) info.address = `${addrMatch[1].trim()} ${addrMatch[2]}, ${addrMatch[3].trim()}`;
  }

  // Hours
  const hoursMatch = text.match(/ימים\s+([^ו]+(?:וערבי חג\s+\S+)?)/);
  if (hoursMatch) info.hours = hoursMatch[1].trim();

  // Shelf number
  const shelfMatch = text.match(/מדף\s+(\d+)/);
  if (shelfMatch) info.shelf = shelfMatch[1];

  // Pickup URL
  const urlMatch = text.match(/(https?:\/\/\S+)/);
  if (urlMatch) info.pickupUrl = urlMatch[1];

  // Israel Post: "הגיעה לסניף [branch] ומחכה לאיסוף"
  if (!info.storeName) {
    const postMatch = text.match(/לסניף\s+([^ו\n]+)/);
    if (postMatch) info.storeName = `דואר ישראל - ${postMatch[1].trim()}`;
  }

  return Object.keys(info).length > 0 ? info : null;
}

/** Core SMS processing logic shared by GET and POST handlers */
async function handleSmsIngest(app: any, key: string, text: string, source?: string) {
  const user = await app.prisma.user.findFirst({ where: { ingestKey: key } });
  if (!user) {
    return { status: 401, body: { error: "Invalid ingest key" } };
  }

  if (!text?.trim()) {
    return { status: 400, body: { error: "Missing SMS text" } };
  }

  const { extractTrackingNumbers, detectCarrier } = await import("../lib/carrier-detect.js");
  const found = extractTrackingNumbers(text);

  // Also try broader SMS patterns (Hebrew delivery SMS)
  const smsPatterns = [
    /(?:tracking|shipment|parcel|package|delivery|מעקב|משלוח|המשלוח)\s*(?:#|number|no\.?|:)?\s*[:.]?\s*([A-Z0-9]{8,30})/gi,
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
    return { status: 200, body: { success: true, added: 0, updated: 0, message: "No tracking numbers found in text" } };
  }

  // Parse pickup location info from SMS
  const pickupInfo = parseSmsPickupInfo(text);

  let added = 0;
  let updated = 0;
  const results: Array<{ trackingNumber: string; carrier: string; status: string }> = [];

  for (const item of found) {
    const existing = await app.prisma.package.findFirst({
      where: { trackingNumber: item.trackingNumber, order: { userId: user.id } },
      include: { order: { select: { id: true } } },
    });

    if (existing) {
      // Update existing package with pickup info from SMS
      if (pickupInfo) {
        let prev: Record<string, any> = {};
        try { if (existing.pickupLocation) prev = JSON.parse(existing.pickupLocation as string); } catch {}
        const pickup: Record<string, any> = {
          ...prev,
          ...(pickupInfo.storeName ? { name: pickupInfo.storeName } : {}),
          ...(pickupInfo.address ? { address: pickupInfo.address } : {}),
          ...(pickupInfo.hours ? { hours: pickupInfo.hours } : {}),
          ...(pickupInfo.shelf ? { shelf: pickupInfo.shelf } : {}),
          ...(pickupInfo.pickupUrl ? { url: pickupInfo.pickupUrl } : {}),
          smsSource: true,
        };
        // Remove carrierOnly flag since we now have real pickup info
        if (pickup.address) delete pickup.carrierOnly;

        await app.prisma.package.update({
          where: { id: existing.id },
          data: {
            pickupLocation: JSON.stringify(pickup),
            status: "OUT_FOR_DELIVERY",
          },
        });
        results.push({ trackingNumber: item.trackingNumber, carrier: item.carrier, status: "updated_pickup" });
        updated++;

        // Notify about pickup update
        try {
          await app.prisma.notification.create({
            data: {
              userId: user.id,
              type: "STATUS_CHANGE",
              title: "📦 Ready for Pickup",
              body: `${item.trackingNumber} is ready${pickupInfo.storeName ? ` at ${pickupInfo.storeName}` : ""}`,
              orderId: existing.order.id,
            },
          });
          await notifyStatusChange(app.prisma, user.id, item.trackingNumber, existing.status, "OUT_FOR_DELIVERY", existing.id);
        } catch (e) {
          app.log.error(`[ingest/sms] Error sending pickup notification: ${e}`);
        }
      } else {
        results.push({ trackingNumber: item.trackingNumber, carrier: item.carrier, status: "already_tracked" });
      }
      continue;
    }

    // Create order + package for new tracking numbers
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
            ...(pickupInfo ? {
              pickupLocation: JSON.stringify({
                ...(pickupInfo.storeName ? { name: pickupInfo.storeName } : {}),
                ...(pickupInfo.address ? { address: pickupInfo.address } : {}),
                ...(pickupInfo.hours ? { hours: pickupInfo.hours } : {}),
                ...(pickupInfo.shelf ? { shelf: pickupInfo.shelf } : {}),
                ...(pickupInfo.pickupUrl ? { url: pickupInfo.pickupUrl } : {}),
                smsSource: true,
              }),
            } : {}),
          },
        },
      },
      include: { packages: true },
    });

    // Fetch tracking data from carrier API
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

    // Send push notification for new package
    try {
      await app.prisma.notification.create({
        data: {
          userId: user.id,
          type: "STATUS_CHANGE",
          title: "📦 New Package Detected",
          body: `${item.trackingNumber} (${item.carrier}) added via SMS`,
          orderId: order.id,
        },
      });
      app.log.info(`[ingest/sms] Created notification for ${item.trackingNumber}, attempting push...`);
      await notifyStatusChange(app.prisma, user.id, item.trackingNumber, "NEW", "PROCESSING", order.packages[0].id);
      app.log.info(`[ingest/sms] Push notification sent for ${item.trackingNumber}`);
    } catch (e) {
      app.log.error(`[ingest/sms] Error sending notification for ${item.trackingNumber}: ${e}`);
    }
  }

  return { status: 200, body: { success: true, added, updated, total: found.length, results } };
}

export const ingestRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/ingest/sms — accepts JSON body { text, source? }
   * GET  /api/ingest/sms  — accepts ?text= query param (for iOS Shortcuts)
   * Auth: API key via ?key= query param or X-Ingest-Key header
   */
  const smsHandler = async (request: any, reply: any) => {
    const key =
      (request.query as any)?.key ??
      (request.headers as any)["x-ingest-key"];

    if (!key) {
      return reply.status(401).send({ error: "Missing ingest key. Pass ?key= or X-Ingest-Key header." });
    }

    // Accept text from: body.text (POST JSON), query.text (GET), or raw body string (POST plain text)
    let text: string | undefined;
    let source: string | undefined;
    if (request.body && typeof request.body === 'object') {
      text = (request.body as any).text;
      source = (request.body as any).source;
    } else if (typeof request.body === 'string') {
      text = request.body;
    }
    if (!text) {
      text = (request.query as any)?.text;
    }

    const result = await handleSmsIngest(app, key, text ?? '', source);
    return reply.status(result.status).send(result.body);
  };

  app.post("/sms", smsHandler);
  app.get("/sms", smsHandler);

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

      // Send push notification for CSV import
      try {
        await notifyStatusChange(app.prisma, userId, tn, "NEW", "PROCESSING", order.packages[0].id);
      } catch (e) {
        // Non-fatal
      }
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


