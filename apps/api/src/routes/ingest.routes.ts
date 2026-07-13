import type { FastifyPluginAsync } from "fastify";
import { randomBytes } from "crypto";
import {
  detectShopPlatform,
  ingestSmsBodySchema,
  ingestCsvBodySchema,
} from "@mailtrack/shared";
import { trackPackage } from "../services/tracking.service.js";
import { syncPackageFromResult } from "../services/package-sync.service.js";
import { notifyStatusChange } from "../services/notification.service.js";
import { extractTrackingNumbers, detectCarrier } from "../lib/carrier-detect.js";

// SMS pattern shared between SMS ingest and scan-text (Hebrew + English).
const SMS_TRACKING_PATTERNS = [
  /(?:tracking|shipment|parcel|package|delivery|מעקב|משלוח|המשלוח)\s*(?:#|number|no\.?|:)?\s*[:.]?\s*([A-Z0-9]{8,30})/gi,
];

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

function safeParsePickup(raw: unknown, log: { warn: (msg: string) => void }): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, any>;
  if (typeof raw !== "string") return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    log.warn(`[ingest] Failed to parse pickup location JSON: ${(err as Error).message}`);
    return {};
  }
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

  const found = extractTrackingNumbers(text);

  // Also try broader SMS patterns (Hebrew delivery SMS)
  const seen = new Set(found.map((f) => f.trackingNumber));
  for (const pattern of SMS_TRACKING_PATTERNS) {
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

  // Batched lookup: one query for all tracking numbers we just extracted.
  const trackingNumbers = found.map((f) => f.trackingNumber);
  const existingPackages = await app.prisma.package.findMany({
    where: {
      trackingNumber: { in: trackingNumbers },
      order: { userId: user.id },
    },
    include: { order: { select: { id: true } } },
  });
  const existingByTn = new Map<string, any>(
    existingPackages.map((p: any) => [p.trackingNumber, p])
  );

  let added = 0;
  let updated = 0;
  const results: Array<{ trackingNumber: string; carrier: string; status: string }> = [];

  for (const item of found) {
    const existing = existingByTn.get(item.trackingNumber);

    if (existing) {
      // Update existing package with pickup info from SMS
      if (pickupInfo) {
        const prev = safeParsePickup(existing.pickupLocation, app.log);
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
   *
   * Auth: ingest API key.
   *   PREFERRED: X-Ingest-Key header (does not leak in access logs / Referer).
   *   ALSO ACCEPTED: ?key= query param — required by iOS Shortcuts and similar
   *     callers that can't easily set headers. Tradeoff: keys may surface in
   *     reverse-proxy access logs. Rotate aggressively if you use this form.
   *
   * Per-key rate limiting is applied: 60 req/min per ingest key.
   */
  const smsHandler = async (request: any, reply: any) => {
    const key =
      (request.headers as any)["x-ingest-key"] ??
      (request.query as any)?.key;

    if (!key) {
      return reply.status(401).send({ error: "Missing ingest key. Pass X-Ingest-Key header (preferred) or ?key=." });
    }

    // Accept text from: body.text (POST JSON), query.text (GET), or raw body string (POST plain text)
    let text: string | undefined;
    let source: string | undefined;
    if (request.body && typeof request.body === "object") {
      const parsed = ingestSmsBodySchema.partial().safeParse(request.body);
      if (parsed.success) {
        text = parsed.data.text;
        source = parsed.data.source;
      }
    } else if (typeof request.body === "string") {
      text = request.body;
    }
    if (!text) {
      text = (request.query as any)?.text;
    }

    // Log for debugging (especially Apple Shortcuts)
    request.server.log.info(
      `[ingest/sms] method=${request.method} content-type=${request.headers["content-type"] ?? "none"} body-type=${typeof request.body} text-len=${text?.length ?? 0} has-text=${!!text}`
    );

    const result = await handleSmsIngest(app, key, text ?? "", source);
    return reply.status(result.status).send(result.body);
  };

  // Per-key rate limit: keyed by ingest key (header or query) so a leaked key
  // can't be brute-forced or abused without limit.
  const smsRateLimitConfig = {
    rateLimit: {
      max: 60,
      timeWindow: "1 minute",
      keyGenerator: (req: any) =>
        req.headers["x-ingest-key"] ?? req.query?.key ?? req.ip,
    },
  };

  app.post("/sms", { config: smsRateLimitConfig }, smsHandler);
  app.get("/sms", { config: smsRateLimitConfig }, smsHandler);

  /**
   * POST /api/ingest/csv
   * Upload a CSV file (Amazon order history, etc.) to import orders.
   * Auth: Bearer token (normal JWT auth)
   * Body: { rows: Array<{ orderId, trackingNumber, store, items, date }> }
   */
  app.post("/csv", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.user.userId;

    const parsed = ingestCsvBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const { rows } = parsed.data;

    if (!rows.length) {
      return { success: true, imported: 0, message: "No rows to import" };
    }

    // Normalize tracking numbers up front; drop rows without one.
    const candidates = rows
      .map((row) => ({
        ...row,
        trackingNumber: row.trackingNumber?.trim().toUpperCase(),
      }))
      .filter((row): row is typeof row & { trackingNumber: string } => !!row.trackingNumber);

    let imported = 0;
    let skipped = rows.length - candidates.length;

    if (candidates.length === 0) {
      return { success: true, imported, skipped, total: rows.length };
    }

    // Batched existence check: one query for all candidates.
    const existing = await app.prisma.package.findMany({
      where: {
        trackingNumber: { in: candidates.map((r) => r.trackingNumber) },
        order: { userId },
      },
      select: { trackingNumber: true },
    });
    const existingTns = new Set(existing.map((p: any) => p.trackingNumber));

    // Validate dates eagerly so we don't store "Invalid Date".
    const toValidDate = (s?: string): Date | null => {
      if (!s) return null;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    for (const row of candidates) {
      const tn = row.trackingNumber;
      if (existingTns.has(tn)) { skipped++; continue; }

      const carrier = detectCarrier(tn);
      const order: any = await app.prisma.order.create({
        data: {
          userId,
          shopPlatform: detectShopPlatform(row.store) as any,
          merchant: row.store ?? "CSV Import",
          externalOrderId: row.orderId ?? `csv-${tn}`,
          orderDate: toValidDate(row.date),
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
        app.log.error(`[ingest/csv] tracking fetch failed for ${tn}: ${(e as Error).message}`);
      }

      imported++;

      // Send push notification for CSV import
      try {
        await notifyStatusChange(app.prisma, userId, tn, "NEW", "PROCESSING", order.packages[0].id);
      } catch (e) {
        app.log.error(`[ingest/csv] notify failed for ${tn}: ${(e as Error).message}`);
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
