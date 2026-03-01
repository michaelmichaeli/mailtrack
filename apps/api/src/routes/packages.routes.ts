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
        orderBy: { updatedAt: "desc" },
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
      const { track17Batch, convert17TrackResult, closeBrowser } = await import("../services/tracking17.service.js");

      const batchSize = 5;
      for (let i = 0; i < packages.length; i += batchSize) {
        const batch = packages.slice(i, i + batchSize);
        const trackingNumbers = batch.map((p) => p.trackingNumber);

        try {
          console.log(`[sync-all] 17track batch ${Math.floor(i / batchSize) + 1}: ${trackingNumbers.join(", ")}`);
          const results = await track17Batch(trackingNumbers);

          for (const pkg of batch) {
            const shipment = results.get(pkg.trackingNumber);
            if (shipment?.shipment) {
              const result = convert17TrackResult(shipment, pkg.carrier as any);
              await syncPackageFromResult(app.prisma, pkg.id, result);
              job.synced++;
              console.log(`[sync-all] ✓ ${pkg.trackingNumber}: ${result.events.length} events`);
            } else {
              try {
                const fallback = await trackPackage(pkg.trackingNumber, pkg.carrier as any, true);
                if (fallback) {
                  await syncPackageFromResult(app.prisma, pkg.id, fallback);
                  job.synced++;
                  console.log(`[sync-all] ✓ ${pkg.trackingNumber} (fallback): ${fallback.events.length} events`);
                }
              } catch (e) {
                console.error(`[sync-all] Fallback failed for ${pkg.trackingNumber}:`, e);
              }
            }
          }
        } catch (e: any) {
          job.errors++;
          console.error(`[sync-all] Batch error:`, e?.message);
        }

        if (i + batchSize < packages.length) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      try { await closeBrowser(); } catch {}

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
  // Save pickup location if available from carrier — enrich with Google Places data
  if (result.pickupLocation && (result.pickupLocation.address || result.pickupLocation.pickupCode)) {
    try {
      const { enrichPickupLocation } = await import("../services/places.service.js");
      const enriched = await enrichPickupLocation(result.pickupLocation);
      updateData.pickupLocation = JSON.stringify(enriched);
    } catch {
      updateData.pickupLocation = JSON.stringify(result.pickupLocation);
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

  // Upsert events — deduplicate by timestamp (within 2 seconds) or upgrade generic email events
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

    if (exists) {
      // Update location if it changed (e.g. location extraction was fixed)
      if (event.location !== exists.location) {
        await prisma.trackingEvent.update({
          where: { id: exists.id },
          data: { location: event.location },
        });
      }
    } else {
      // Check if there's a generic email-sourced event at a similar time (within 6 hours)
      // that we can upgrade with richer carrier data
      const genericWindow = 6 * 60 * 60 * 1000;
      const genericEvent = await prisma.trackingEvent.findFirst({
        where: {
          packageId,
          status: event.status as any,
          location: null,
          timestamp: {
            gte: new Date(eventTime.getTime() - genericWindow),
            lte: new Date(eventTime.getTime() + genericWindow),
          },
        },
      });

      if (genericEvent && event.location) {
        // Upgrade the generic event with richer data
        await prisma.trackingEvent.update({
          where: { id: genericEvent.id },
          data: {
            timestamp: eventTime,
            location: event.location,
            description: event.description,
          },
        });
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
