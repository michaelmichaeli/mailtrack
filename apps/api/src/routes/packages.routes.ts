import type { FastifyPluginAsync } from "fastify";
import { searchParamsSchema } from "@mailtrack/shared";
import { trackPackage } from "../services/tracking.service.js";
import { notifyStatusChange } from "../services/notification.service.js";

export const packageRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/packages — List orders with their packages (search/filter)
  app.get("/", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;
    const params = searchParamsSchema.parse(request.query);

    const where: any = { userId };

    if (params.merchant) {
      where.merchant = { contains: params.merchant, mode: "insensitive" };
    }
    if (params.query) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { merchant: { contains: params.query, mode: "insensitive" } },
            { externalOrderId: { contains: params.query, mode: "insensitive" } },
            { items: { contains: params.query, mode: "insensitive" } },
            { packages: { some: { trackingNumber: { contains: params.query, mode: "insensitive" } } } },
            { packages: { some: { items: { contains: params.query, mode: "insensitive" } } } },
          ],
        },
      ];
    }
    if (params.status) {
      // Match order-level OR package-level status
      where.AND = [
        ...(where.AND ?? []),
        { OR: [{ status: params.status }, { packages: { some: { status: params.status } } }] },
      ];
    }
    if (params.dateFrom || params.dateTo) {
      const dateFilter: any = {};
      if (params.dateFrom) dateFilter.gte = new Date(params.dateFrom);
      if (params.dateTo) dateFilter.lte = new Date(params.dateTo);
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { orderDate: dateFilter },
            { orderDate: null, createdAt: dateFilter },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      app.prisma.order.findMany({
        where,
        include: {
          packages: {
            include: { events: { orderBy: { timestamp: "asc" }, take: 1, select: { timestamp: true } } },
          },
        },
        orderBy: { [params.sortBy]: params.sortOrder },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      app.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((o: Record<string, any>) => {
        const pkg = o.packages[0];
        // Derive effective date: orderDate → earliest tracking event → createdAt
        const earliestEventTime = pkg?.events?.[0]?.timestamp || null;
        const effectiveDate = o.orderDate || earliestEventTime || o.createdAt;
        return {
          id: o.id,
          externalOrderId: o.externalOrderId,
          shopPlatform: o.shopPlatform,
          merchant: o.merchant,
          orderDate: (effectiveDate || o.createdAt).toISOString(),
          totalAmount: o.totalAmount,
          currency: o.currency,
          items: o.items,
          status: o.status,
          createdAt: o.createdAt.toISOString(),
          updatedAt: o.updatedAt.toISOString(),
          package: pkg
            ? {
                id: pkg.id,
                trackingNumber: pkg.trackingNumber,
                carrier: pkg.carrier,
                status: pkg.status,
                estimatedDelivery: pkg.estimatedDelivery?.toISOString() ?? null,
                lastLocation: pkg.lastLocation,
                items: pkg.items,
                pickupLocation: pkg.pickupLocation,
              }
            : null,
        };
      }),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  });

  // GET /api/packages/sync-status — Poll sync progress
  app.get("/sync-status", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;
    const job = syncJobs.get(userId);
    if (!job) return { status: "idle", synced: 0, errors: 0, total: 0 };
    return job;
  });

  // GET /api/packages/:id — Get package detail
  app.get("/:id", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;

    const pkg = await app.prisma.package.findFirst({
      where: { id, order: { userId } },
      include: {
        order: true,
        events: { orderBy: { timestamp: "desc" } },
      },
    });

    if (!pkg) {
      return reply.status(404).send({ error: "Package not found" });
    }

    return {
      id: pkg.id,
      orderId: pkg.orderId,
      trackingNumber: pkg.trackingNumber,
      carrier: pkg.carrier,
      status: pkg.status,
      estimatedDelivery: pkg.estimatedDelivery?.toISOString() ?? null,
      lastLocation: pkg.lastLocation,
      items: pkg.items,
      createdAt: pkg.createdAt.toISOString(),
      updatedAt: pkg.updatedAt.toISOString(),
      order: {
        id: pkg.order.id,
        userId: pkg.order.userId,
        shopPlatform: pkg.order.shopPlatform,
        externalOrderId: pkg.order.externalOrderId,
        orderDate: pkg.order.orderDate?.toISOString() ?? null,
        merchant: pkg.order.merchant,
        totalAmount: pkg.order.totalAmount,
        currency: pkg.order.currency,
        createdAt: pkg.order.createdAt.toISOString(),
        updatedAt: pkg.order.updatedAt.toISOString(),
      },
      events: pkg.events.map((e: Record<string, any>) => ({
        id: e.id,
        packageId: e.packageId,
        timestamp: e.timestamp.toISOString(),
        location: e.location,
        status: e.status,
        description: e.description,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  });

  // POST /api/packages/:id/refresh — Refresh tracking info from Cainiao
  app.post("/:id/refresh", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;

    const pkg = await app.prisma.package.findFirst({
      where: { id, order: { userId } },
    });

    if (!pkg) {
      return reply.status(404).send({ error: "Package not found" });
    }

    const result = await trackPackage(pkg.trackingNumber, pkg.carrier as any, true);

    if (result) {
      await syncPackageFromResult(app.prisma, id, result);
    }

    // Always clean up bad locations on existing events
    await cleanupBadLocations(app.prisma, id);

    return { success: true, updated: !!result };
  });

  // Sync progress tracking (in-memory, per-user)
  const syncJobs = new Map<string, { status: "running" | "done" | "error"; synced: number; errors: number; total: number; message?: string }>();

  // POST /api/packages/sync-all — Start background sync, return immediately
  app.post("/sync-all", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;

    // If already running for this user, return current status
    const existing = syncJobs.get(userId);
    if (existing?.status === "running") {
      return { success: true, ...existing, status: "running" };
    }

    const { clearRateLimits } = await import("../services/tracking.service.js");
    clearRateLimits();

    const packages = await app.prisma.package.findMany({
      where: { order: { userId } },
      select: { id: true, trackingNumber: true, carrier: true, status: true },
    });

    // Initialize progress
    syncJobs.set(userId, { status: "running", synced: 0, errors: 0, total: packages.length });

    // Run sync in background (don't await)
    (async () => {
      const job = syncJobs.get(userId)!;
      let use17track = true;
      let track17Batch: any, convert17TrackResult: any, closeBrowser: any;

      try {
        const mod = await import("../services/tracking17.service.js");
        track17Batch = mod.track17Batch;
        convert17TrackResult = mod.convert17TrackResult;
        closeBrowser = mod.closeBrowser;
      } catch {
        use17track = false;
        console.log("[sync-all] 17track unavailable, using Cainiao only");
      }

      const batchSize = 5;
      for (let i = 0; i < packages.length; i += batchSize) {
        const batch = packages.slice(i, i + batchSize);

        // Try 17track batch first
        let results17 = new Map();
        if (use17track) {
          try {
            const trackingNumbers = batch.map((p) => p.trackingNumber);
            console.log(`[sync-all] 17track batch ${Math.floor(i / batchSize) + 1}: ${trackingNumbers.join(", ")}`);
            results17 = await track17Batch(trackingNumbers);
          } catch (e: any) {
            console.log(`[sync-all] 17track batch failed, falling back to Cainiao: ${e?.message}`);
            use17track = false; // Don't try 17track again
          }
        }

        // Process each package — use 17track result or fallback to Cainiao
        for (const pkg of batch) {
          try {
            const shipment = results17.get(pkg.trackingNumber);
            if (shipment?.shipment) {
              const result = convert17TrackResult(shipment, pkg.carrier as any);
              await syncPackageFromResult(app.prisma, pkg.id, result);
              job.synced++;
              console.log(`[sync-all] ✓ ${pkg.trackingNumber}: ${result.events.length} events`);
            } else {
              const fallback = await trackPackage(pkg.trackingNumber, pkg.carrier as any, true);
              if (fallback) {
                await syncPackageFromResult(app.prisma, pkg.id, fallback);
                job.synced++;
                console.log(`[sync-all] ✓ ${pkg.trackingNumber} (cainiao): ${fallback.events.length} events`);
              }
            }
            // Always clean up bad locations
            await cleanupBadLocations(app.prisma, pkg.id);
          } catch (e: any) {
            job.errors++;
            console.error(`[sync-all] Error syncing ${pkg.trackingNumber}:`, e?.message);
          }
        }

        if (i + batchSize < packages.length) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      if (closeBrowser) { try { await closeBrowser(); } catch {} }

      // Enrich pickup locations
      try {
        const { enrichPickupLocation } = await import("../services/places.service.js");
        const pkgsWithPickup = await app.prisma.package.findMany({
          where: { order: { userId }, pickupLocation: { not: null } },
          select: { id: true, pickupLocation: true, trackingNumber: true },
        });
        for (const p of pkgsWithPickup) {
          const pickup = typeof p.pickupLocation === "string" ? JSON.parse(p.pickupLocation) : p.pickupLocation;
          if (pickup && !pickup.hours && (pickup.name || pickup.address)) {
            const enriched = await enrichPickupLocation(pickup);
            if (enriched?.hours) {
              await app.prisma.package.update({ where: { id: p.id }, data: { pickupLocation: JSON.stringify(enriched) } });
              console.log(`[sync-all] Enriched pickup for ${p.trackingNumber}: ${enriched.name}`);
            }
          }
        }
      } catch (e: any) {
        console.error("[sync-all] Pickup enrichment error:", e?.message);
      }

      job.status = "done";
      console.log(`[sync-all] Complete: ${job.synced} synced, ${job.errors} errors, ${job.total} total`);
      // Clean up after 5 minutes
      setTimeout(() => syncJobs.delete(userId), 5 * 60 * 1000);
    })().catch((e) => {
      const job = syncJobs.get(userId);
      if (job) { job.status = "error"; job.message = e?.message; }
      console.error("[sync-all] Fatal error:", e);
    });

    return { success: true, status: "running", synced: 0, errors: 0, total: packages.length };
  });

  // POST /api/packages/scan-text — Extract tracking numbers from pasted text (SMS, etc.)
  app.post("/scan-text", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.user.userId;
    const { text } = request.body as { text: string };

    if (!text?.trim()) {
      return reply.status(400).send({ error: "Text is required" });
    }

    const { extractTrackingNumbers, detectCarrier } = await import("../lib/carrier-detect.js");
    const found = extractTrackingNumbers(text);

    // Also try broader patterns for common SMS formats
    const smsPatterns = [
      /(?:tracking|shipment|parcel|package|delivery)\s*(?:#|number|no\.?|:)?\s*[:.]?\s*([A-Z0-9]{8,30})/gi,
      /(?:track(?:ing)?|מעקב|משלוח)\s*[:.]?\s*([A-Z0-9]{8,30})/gi,
    ];

    const seen = new Set(found.map((f) => f.trackingNumber));
    for (const pattern of smsPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const tn = match[1].toUpperCase();
        if (!seen.has(tn) && tn.length >= 8) {
          // Filter out common false positives (all digits < 10 chars, etc.)
          if (/^\d{8,9}$/.test(tn)) continue;
          seen.add(tn);
          found.push({ trackingNumber: tn, carrier: detectCarrier(tn) });
        }
      }
    }

    // Check which are already tracked
    const results = [];
    for (const item of found) {
      const existing = await app.prisma.package.findFirst({
        where: { trackingNumber: item.trackingNumber, order: { userId } },
      });
      results.push({
        trackingNumber: item.trackingNumber,
        carrier: item.carrier,
        alreadyTracked: !!existing,
        packageId: existing?.id ?? null,
      });
    }

    return { found: results, total: results.length };
  });

  // POST /api/packages/add — Manually add a package by tracking number
  app.post("/add", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.user.userId;
    const { trackingNumber, carrier, description } = request.body as {
      trackingNumber: string;
      carrier?: string;
      description?: string;
    };

    if (!trackingNumber?.trim()) {
      return reply.status(400).send({ error: "Tracking number is required" });
    }

    const tn = trackingNumber.trim().toUpperCase();

    // Check if already tracked
    const existing = await app.prisma.package.findFirst({
      where: { trackingNumber: tn, order: { userId } },
    });
    if (existing) {
      return { success: true, alreadyExists: true, orderId: existing.orderId, packageId: existing.id };
    }

    // Auto-detect carrier if not provided
    const { detectCarrier } = await import("../lib/carrier-detect.js");
    const detectedCarrier = carrier || detectCarrier(tn);

    // Create an order + package for the manual entry
    const order: any = await app.prisma.order.create({
      data: {
        userId,
        shopPlatform: "UNKNOWN",
        merchant: description || "Manual Entry",
        externalOrderId: `manual-${tn}`,
        status: "PROCESSING",
        items: description ? JSON.stringify([description]) : null,
        packages: {
          create: {
            trackingNumber: tn,
            carrier: detectedCarrier as any,
            status: "PROCESSING" as any,
            items: description ? JSON.stringify([description]) : null,
          },
        },
      },
      include: { packages: true },
    });

    // Try to fetch tracking data immediately
    const pkg = order.packages[0];
    try {
      const result = await trackPackage(tn, detectedCarrier as any);
      if (result) {
        await syncPackageFromResult(app.prisma, pkg.id, result);
      }
    } catch (e) {
      console.error(`[add] Error fetching tracking for ${tn}:`, e);
    }

    return { success: true, orderId: order.id, packageId: pkg.id };
  });
};

// Known-bad location patterns (extracted from descriptions, not real places)
const BAD_LOCATION_PATTERNS = /\b(customs|warehouse|designated location|transit|sorting center|departed|arrived|received|collected|carrier)\b/i;

/** Clean up events with bad locations that were incorrectly extracted from descriptions */
async function cleanupBadLocations(prisma: any, packageId: string) {
  const events = await prisma.trackingEvent.findMany({
    where: { packageId, location: { not: null } },
    select: { id: true, location: true },
  });

  let cleaned = 0;
  for (const event of events) {
    if (event.location && BAD_LOCATION_PATTERNS.test(event.location) && !/\[/.test(event.location)) {
      await prisma.trackingEvent.update({
        where: { id: event.id },
        data: { location: null },
      });
      cleaned++;
    }
  }

  // Clear fabricated pickup locations (those with Google Places-enriched addresses
  // but no real pickup data from the carrier API)
  const pkgForPickup = await prisma.package.findUnique({ where: { id: packageId }, select: { pickupLocation: true } });
  if (pkgForPickup?.pickupLocation) {
    let pl = pkgForPickup.pickupLocation;
    if (typeof pl === "string") try { pl = JSON.parse(pl); } catch { pl = null; }
    if (pl && typeof pl === "object" && !pl.carrierOnly) {
      // If it has lat/lng from Google Places but no pickupCode, it was fabricated
      const hasCoords = pl.lat || pl.lng;
      const hasPickupCode = pl.pickupCode;
      if (hasCoords && !hasPickupCode) {
        // Clear fabricated pickup — will be re-synced with carrier-only data
        await prisma.package.update({ where: { id: packageId }, data: { pickupLocation: null } });
        cleaned++;
      }
    }
  }

  if (cleaned > 0) {
    // Recalculate lastLocation from remaining valid events
    const latestWithLocation = await prisma.trackingEvent.findFirst({
      where: { packageId, location: { not: null } },
      orderBy: { timestamp: "desc" },
    });
    await prisma.package.update({
      where: { id: packageId },
      data: { lastLocation: latestWithLocation?.location ?? null },
    });
  }

  // Fix customs events wrongly marked as DELIVERED
  const customsEvents = await prisma.trackingEvent.findMany({
    where: { packageId, status: "DELIVERED", description: { contains: "customs" } },
    select: { id: true },
  });
  for (const ce of customsEvents) {
    await prisma.trackingEvent.update({ where: { id: ce.id }, data: { status: "IN_TRANSIT" } });
  }

  // Deduplicate events: remove near-duplicate events with same status within 6 hours
  await deduplicateEvents(prisma, packageId);
}

/** Remove duplicate events — keep the one with richer data (location or longer description) */
async function deduplicateEvents(prisma: any, packageId: string) {
  const events = await prisma.trackingEvent.findMany({
    where: { packageId },
    orderBy: { timestamp: "asc" },
  });

  const toDelete: string[] = [];
  const STATUS_WINDOW = 6 * 60 * 60 * 1000;

  for (let i = 0; i < events.length; i++) {
    if (toDelete.includes(events[i].id)) continue;
    for (let j = i + 1; j < events.length; j++) {
      if (toDelete.includes(events[j].id)) continue;
      if (events[i].status !== events[j].status) continue;
      const timeDiff = Math.abs(new Date(events[i].timestamp).getTime() - new Date(events[j].timestamp).getTime());
      if (timeDiff > STATUS_WINDOW) continue;

      // Same status within time window — keep the one with better data
      const iHasLoc = !!events[i].location;
      const jHasLoc = !!events[j].location;
      const iDescLen = events[i].description?.length ?? 0;
      const jDescLen = events[j].description?.length ?? 0;

      if (jHasLoc && !iHasLoc) {
        toDelete.push(events[i].id);
        break; // i is deleted, move on
      } else if (iHasLoc && !jHasLoc) {
        toDelete.push(events[j].id);
      } else if (jDescLen > iDescLen) {
        toDelete.push(events[i].id);
        break;
      } else {
        toDelete.push(events[j].id);
      }
    }
  }

  if (toDelete.length > 0) {
    await prisma.trackingEvent.deleteMany({
      where: { id: { in: toDelete } },
    });
    console.log(`[cleanup] Removed ${toDelete.length} duplicate events for package ${packageId}`);
  }
}

/** Merge carrier result into DB: update status, upsert events, send notifications */
async function syncPackageFromResult(prisma: any, packageId: string, result: any) {
  // Get current package to detect status change
  const currentPkg = await prisma.package.findUnique({
    where: { id: packageId },
    include: { order: { select: { id: true, userId: true } } },
  });
  const oldStatus = currentPkg?.status;

  // Never downgrade from terminal statuses (DELIVERED, RETURNED)
  const TERMINAL = ["DELIVERED", "RETURNED"];
  if (TERMINAL.includes(oldStatus) && !TERMINAL.includes(result.status)) {
    // Still upsert events but don't change status
    result.status = oldStatus;
  }

  // Update package status, location, pickup info, and estimated delivery
  const updateData: any = {
    status: result.status as any,
    lastLocation: result.lastLocation ?? null,
    ...(result.estimatedDelivery ? { estimatedDelivery: new Date(result.estimatedDelivery) } : {}),
  };
  // Save pickup/carrier info
  if (result.pickupLocation) {
    if (result.pickupLocation.carrierOnly) {
      // Carrier info only — save directly, don't send to Google Places
      updateData.pickupLocation = JSON.stringify(result.pickupLocation);
    } else if (result.pickupLocation.address || result.pickupLocation.pickupCode) {
      // Real pickup address — enrich with Google Places
      try {
        const { enrichPickupLocation } = await import("../services/places.service.js");
        const enriched = await enrichPickupLocation(result.pickupLocation);
        if (enriched) {
          updateData.pickupLocation = JSON.stringify(enriched);
        }
      } catch {
        updateData.pickupLocation = JSON.stringify(result.pickupLocation);
      }
    }
  }
  await prisma.package.update({
    where: { id: packageId },
    data: updateData,
  });

  // Keep order status in sync with package status
  if (currentPkg) {
    await prisma.order.update({
      where: { id: currentPkg.order.id },
      data: { status: result.status as any },
    });
  }

  // Send push notification if status changed
  if (currentPkg && oldStatus !== result.status) {
    try {
      await notifyStatusChange(
        prisma,
        currentPkg.order.userId,
        currentPkg.trackingNumber,
        oldStatus,
        result.status,
        packageId
      );
    } catch (e) {
      console.error("[notify] Error sending notification:", e);
    }
  }

  // Upsert events — deduplicate by timestamp+description or by status within time window
  for (const event of result.events) {
    const eventTime = new Date(event.timestamp);
    const windowStart = new Date(eventTime.getTime() - 2000);
    const windowEnd = new Date(eventTime.getTime() + 2000);

    // Exact match: same timestamp (within 2s) and same description
    const exactMatch = await prisma.trackingEvent.findFirst({
      where: {
        packageId,
        timestamp: { gte: windowStart, lte: windowEnd },
        description: event.description,
      },
    });

    if (exactMatch) {
      // Update location if it changed
      if (event.location !== exactMatch.location) {
        await prisma.trackingEvent.update({
          where: { id: exactMatch.id },
          data: { location: event.location },
        });
      }
    } else {
      // Check for same-status event within 6 hours (likely duplicate from different source)
      const statusWindow = 6 * 60 * 60 * 1000;
      const statusMatch = await prisma.trackingEvent.findFirst({
        where: {
          packageId,
          status: event.status as any,
          timestamp: {
            gte: new Date(eventTime.getTime() - statusWindow),
            lte: new Date(eventTime.getTime() + statusWindow),
          },
        },
      });

      if (statusMatch) {
        // Upgrade existing event if new one has better data (location or more specific description)
        const shouldUpgrade = (event.location && !statusMatch.location) ||
          (event.description.length > (statusMatch.description?.length ?? 0));
        if (shouldUpgrade) {
          await prisma.trackingEvent.update({
            where: { id: statusMatch.id },
            data: {
              timestamp: eventTime,
              location: event.location || statusMatch.location,
              description: event.description,
            },
          });
        }
        // Skip creating duplicate — status match within time window is sufficient
      } else {
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
}
