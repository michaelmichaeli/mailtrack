import type { FastifyPluginAsync } from "fastify";
import {
  searchParamsSchema,
  scanTextBodySchema,
  addPackageBodySchema,
} from "@mailtrack/shared";
import { trackPackage, clearRateLimits } from "../services/tracking.service.js";
import { syncPackageFromResult } from "../services/package-sync.service.js";
import { extractTrackingNumbers, detectCarrier } from "../lib/carrier-detect.js";
import { isIsraelPostPackage, trackIsraelPostBatch } from "../services/israelpost.service.js";
import { enrichPickupLocation } from "../services/places.service.js";
import * as track17 from "../services/tracking17.service.js";

// ─── Sync job state (Redis-backed) ────────────────────────────────────────
//
// Replaces the previous in-memory Map so that:
//   1. Status survives a restart.
//   2. Multiple API instances see the same job state behind a load balancer.
//   3. Multiple sync-all calls from the same user don't race the cleanup
//      timer or produce stale state.

type SyncJobState = {
  status: "running" | "done" | "error";
  synced: number;
  errors: number;
  total: number;
  message?: string;
  updatedAt: number;
};

const SYNC_JOB_TTL_SECONDS = 5 * 60; // matches the previous "clean up after 5 minutes"
const syncJobKey = (userId: string) => `mailtrack:sync-job:${userId}`;

async function readSyncJob(redis: any, userId: string): Promise<SyncJobState | null> {
  try {
    const raw = await redis.get(syncJobKey(userId));
    return raw ? (JSON.parse(raw) as SyncJobState) : null;
  } catch {
    return null;
  }
}
async function writeSyncJob(redis: any, userId: string, state: SyncJobState): Promise<void> {
  try {
    await redis.set(
      syncJobKey(userId),
      JSON.stringify({ ...state, updatedAt: Date.now() }),
      "EX",
      SYNC_JOB_TTL_SECONDS
    );
  } catch {
    // Redis unavailable — sync still runs, status reads will return idle.
  }
}
async function deleteSyncJob(redis: any, userId: string): Promise<void> {
  try { await redis.del(syncJobKey(userId)); } catch {}
}

// Known-bad location patterns (extracted from descriptions, not real places)
const BAD_LOCATION_PATTERNS = /\b(customs|warehouse|designated location|transit|sorting center|departed|arrived|received|collected|carrier|canada|vancouver|toronto|montreal|china|shenzhen|guangzhou|shanghai|beijing|shatian|dongguan|yiwu|hangzhou|united states|new york|los angeles|chicago|germany|berlin|munich|france|paris|uk|london|netherlands|amsterdam|russia|moscow)\b/i;

// For Israeli packages: only accept locations with Hebrew chars or known Israeli city names
const ISRAELI_LOCATION_VALID = /[֐-׿]|israel|tel\s*aviv|jerusalem|haifa|beer\s*sheva|ashdod|ashkelon|netanya|herzliya|ramat\s*gan|petah\s*tikva|rishon|holon|bat\s*yam|rehovot|kfar\s*saba|modi.in|eilat|tiberias|nazareth|acre|akko|nahariya|kiryat|raanana|givatayim|bnei\s*brak|lod|ramla|arad|dimona|yavne|or\s*yehuda|rosh\s*ha.ain/i;

const STATUS_DEDUP_WINDOW_MS = 6 * 60 * 60 * 1000;
const SCAN_TEXT_PATTERNS = [
  /(?:tracking|shipment|parcel|package|delivery)\s*(?:#|number|no\.?|:)?\s*[:.]?\s*([A-Z0-9]{8,30})/gi,
  /(?:track(?:ing)?|מעקב|משלוח)\s*[:.]?\s*([A-Z0-9]{8,30})/gi,
];

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
    const job = await readSyncJob(app.redis, userId);
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
    await cleanupBadLocations(app.prisma, id, app.log);

    return { success: true, updated: !!result };
  });

  // POST /api/packages/sync-all — Start background sync, return immediately
  app.post("/sync-all", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;

    // If already running for this user, return current status
    const existing = await readSyncJob(app.redis, userId);
    if (existing?.status === "running") {
      return { success: true, ...existing };
    }

    clearRateLimits();

    const packages = await app.prisma.package.findMany({
      where: { order: { userId } },
      select: { id: true, trackingNumber: true, carrier: true, status: true },
    });

    // Initialize progress
    await writeSyncJob(app.redis, userId, {
      status: "running",
      synced: 0,
      errors: 0,
      total: packages.length,
      updatedAt: Date.now(),
    });

    // Run sync in background (don't await). Local counters batched to Redis
    // periodically so a crash doesn't lose progress visibility.
    (async () => {
      let synced = 0;
      let errors = 0;
      let lastFlush = 0;
      const flushProgress = async (force = false) => {
        const now = Date.now();
        if (force || now - lastFlush > 1000) {
          await writeSyncJob(app.redis, userId, {
            status: "running",
            synced,
            errors,
            total: packages.length,
            updatedAt: now,
          });
          lastFlush = now;
        }
      };

      let use17track = true;

      // Split packages: Israel Post vs others
      const israelPostPkgs = packages.filter((p) => isIsraelPostPackage(p.trackingNumber, p.carrier));
      const otherPkgs = packages.filter((p) => !isIsraelPostPackage(p.trackingNumber, p.carrier));

      app.log.info(
        `[sync-all] ${israelPostPkgs.length} Israel Post + ${otherPkgs.length} other packages for user ${userId}`
      );

      // Run Israel Post and 17track in parallel
      const israelPostPromise = (async () => {
        if (israelPostPkgs.length === 0) return;
        try {
          const trackingNumbers = israelPostPkgs.map((p) => p.trackingNumber);
          const results = await trackIsraelPostBatch(trackingNumbers, 5);

          for (const pkg of israelPostPkgs) {
            try {
              const result = results.get(pkg.trackingNumber);
              if (result) {
                await syncPackageFromResult(app.prisma, pkg.id, result);
                synced++;
              } else {
                // Fallback: try 17track with location stripping
                const fallback = await trackPackage(pkg.trackingNumber, pkg.carrier as any, true);
                if (fallback) {
                  await syncPackageFromResult(app.prisma, pkg.id, fallback);
                  synced++;
                }
              }
              await flushProgress();
            } catch (e: any) {
              errors++;
              app.log.error(`[sync-all] Error syncing ${pkg.trackingNumber}: ${e?.message}`);
            }
          }
        } catch (e: any) {
          app.log.error(`[sync-all] Israel Post batch error: ${e?.message}`);
          // Fallback: try each individually via trackPackage
          for (const pkg of israelPostPkgs) {
            try {
              const fallback = await trackPackage(pkg.trackingNumber, pkg.carrier as any, true);
              if (fallback) {
                await syncPackageFromResult(app.prisma, pkg.id, fallback);
                synced++;
              }
            } catch {
              errors++;
            }
            await flushProgress();
          }
        }
      })();

      const otherPromise = (async () => {
        if (otherPkgs.length === 0) return;
        const batchSize = 10;
        for (let i = 0; i < otherPkgs.length; i += batchSize) {
          const batch = otherPkgs.slice(i, i + batchSize);

          let results17 = new Map<string, any>();
          if (use17track) {
            try {
              const trackingNumbers = batch.map((p) => p.trackingNumber);
              app.log.debug(
                `[sync-all] 17track batch ${Math.floor(i / batchSize) + 1}: ${trackingNumbers.join(", ")}`
              );
              results17 = await track17.track17Batch(trackingNumbers);
            } catch (e: any) {
              app.log.warn(`[sync-all] 17track batch failed, falling back: ${e?.message}`);
              use17track = false;
            }
          }

          for (const pkg of batch) {
            try {
              const shipment = results17.get(pkg.trackingNumber);
              if (shipment?.shipment) {
                const result = track17.convert17TrackResult(shipment, pkg.carrier as any);
                await syncPackageFromResult(app.prisma, pkg.id, result);
                synced++;
              } else {
                const fallback = await trackPackage(pkg.trackingNumber, pkg.carrier as any, true);
                if (fallback) {
                  await syncPackageFromResult(app.prisma, pkg.id, fallback);
                  synced++;
                }
              }
            } catch (e: any) {
              errors++;
              app.log.error(`[sync-all] Error syncing ${pkg.trackingNumber}: ${e?.message}`);
            }
          }
          await flushProgress();

          if (i + batchSize < otherPkgs.length) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      })();

      // Wait for both pools to finish
      const settled = await Promise.allSettled([israelPostPromise, otherPromise]);
      const failures = settled
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));

      try { await track17.closeBrowser(); } catch {}

      // Clean up bad locations across all packages
      for (const pkg of packages) {
        try { await cleanupBadLocations(app.prisma, pkg.id, app.log); } catch {}
      }

      // Enrich pickup locations
      try {
        const pkgsWithPickup = await app.prisma.package.findMany({
          where: { order: { userId }, pickupLocation: { not: null } },
          select: { id: true, pickupLocation: true, trackingNumber: true },
        });
        for (const p of pkgsWithPickup) {
          let pickup: any = p.pickupLocation;
          if (typeof pickup === "string") {
            try { pickup = JSON.parse(pickup); } catch (err) {
              app.log.warn(`[sync-all] bad pickupLocation JSON on ${p.trackingNumber}: ${(err as Error).message}`);
              continue;
            }
          }
          if (pickup && !pickup.hours && (pickup.name || pickup.address)) {
            const enriched = await enrichPickupLocation(pickup);
            if (enriched?.hours) {
              await app.prisma.package.update({
                where: { id: p.id },
                data: { pickupLocation: JSON.stringify(enriched) },
              });
              app.log.info(`[sync-all] Enriched pickup for ${p.trackingNumber}: ${enriched.name}`);
            }
          }
        }
      } catch (e: any) {
        app.log.error(`[sync-all] Pickup enrichment error: ${e?.message}`);
      }

      // Final write — surface partial-failure messages so users polling sync-status see them.
      const finalState: SyncJobState = failures.length
        ? {
            status: "error",
            synced,
            errors: errors + failures.length,
            total: packages.length,
            message: failures.join("; "),
            updatedAt: Date.now(),
          }
        : { status: "done", synced, errors, total: packages.length, updatedAt: Date.now() };

      await writeSyncJob(app.redis, userId, finalState);
      app.log.info(
        `[sync-all] Complete for ${userId}: ${synced} synced, ${finalState.errors} errors, ${packages.length} total`
      );

      // Drop the job from Redis after the TTL elapses naturally — no setTimeout needed.
      setTimeout(() => { void deleteSyncJob(app.redis, userId); }, SYNC_JOB_TTL_SECONDS * 1000).unref();
    })().catch(async (e) => {
      app.log.error(e, "[sync-all] Fatal error");
      await writeSyncJob(app.redis, userId, {
        status: "error",
        synced: 0,
        errors: 0,
        total: packages.length,
        message: e?.message ?? "fatal",
        updatedAt: Date.now(),
      });
    });

    return { success: true, status: "running", synced: 0, errors: 0, total: packages.length };
  });

  // POST /api/packages/scan-text — Extract tracking numbers from pasted text (SMS, etc.)
  app.post("/scan-text", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.user.userId;

    const parsed = scanTextBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Text is required", details: parsed.error.flatten() });
    }
    const { text } = parsed.data;

    const found = extractTrackingNumbers(text);

    // Also try broader patterns for common SMS formats
    const seen = new Set(found.map((f) => f.trackingNumber));
    for (const pattern of SCAN_TEXT_PATTERNS) {
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

    if (found.length === 0) {
      return { found: [], total: 0 };
    }

    // BATCHED existence check — was N+1 (one findFirst per tracking number).
    const trackingNumbers = found.map((f) => f.trackingNumber);
    const existing = await app.prisma.package.findMany({
      where: {
        trackingNumber: { in: trackingNumbers },
        order: { userId },
      },
      select: { id: true, trackingNumber: true },
    });
    const existingByTn = new Map<string, string>(
      existing.map((p: any) => [p.trackingNumber, p.id])
    );

    const results = found.map((item) => ({
      trackingNumber: item.trackingNumber,
      carrier: item.carrier,
      alreadyTracked: existingByTn.has(item.trackingNumber),
      packageId: existingByTn.get(item.trackingNumber) ?? null,
    }));

    return { found: results, total: results.length };
  });

  // POST /api/packages/add — Manually add a package by tracking number
  app.post("/add", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.user.userId;

    const parsed = addPackageBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const { trackingNumber, carrier, description } = parsed.data;
    const tn = trackingNumber.trim().toUpperCase();

    // Check if already tracked
    const existing = await app.prisma.package.findFirst({
      where: { trackingNumber: tn, order: { userId } },
    });
    if (existing) {
      return { success: true, alreadyExists: true, orderId: existing.orderId, packageId: existing.id };
    }

    // Auto-detect carrier if not provided
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
      app.log.error(`[add] Error fetching tracking for ${tn}: ${(e as Error).message}`);
    }

    return { success: true, orderId: order.id, packageId: pkg.id };
  });
};

/** Clean up events with bad locations that were incorrectly extracted from descriptions */
async function cleanupBadLocations(prisma: any, packageId: string, log: { warn: (msg: string) => void }) {
  const pkg = await prisma.package.findUnique({ where: { id: packageId }, select: { carrier: true } });
  const isIsraeliPackage = pkg?.carrier === "ISRAEL_POST";

  const events = await prisma.trackingEvent.findMany({
    where: { packageId, location: { not: null } },
    select: { id: true, location: true },
  });

  let cleaned = 0;
  for (const event of events) {
    if (!event.location) continue;

    let shouldClear = false;

    // Always clear generic bad patterns
    if (BAD_LOCATION_PATTERNS.test(event.location) && !/\[/.test(event.location)) {
      shouldClear = true;
    }

    // For Israeli packages: clear any non-Israeli location
    if (isIsraeliPackage && !shouldClear && !ISRAELI_LOCATION_VALID.test(event.location)) {
      shouldClear = true;
    }

    if (shouldClear) {
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
    let pl: any = pkgForPickup.pickupLocation;
    if (typeof pl === "string") {
      try { pl = JSON.parse(pl); }
      catch (err) {
        log.warn(`[cleanup] bad pickupLocation JSON on ${packageId}: ${(err as Error).message}`);
        pl = null;
      }
    }
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

/**
 * Remove duplicate events — keep the one with richer data (location or longer description).
 *
 * Was O(n²) with `Array.includes` for the "already deleted" check; now uses a
 * Set for O(1) lookups, making this comfortably linear in practice.
 */
async function deduplicateEvents(prisma: any, packageId: string) {
  const events = await prisma.trackingEvent.findMany({
    where: { packageId },
    orderBy: { timestamp: "asc" },
  });

  const toDelete = new Set<string>();

  for (let i = 0; i < events.length; i++) {
    if (toDelete.has(events[i].id)) continue;
    for (let j = i + 1; j < events.length; j++) {
      if (toDelete.has(events[j].id)) continue;
      if (events[i].status !== events[j].status) continue;
      const timeDiff = Math.abs(
        new Date(events[i].timestamp).getTime() - new Date(events[j].timestamp).getTime()
      );
      if (timeDiff > STATUS_DEDUP_WINDOW_MS) continue;

      // Same status within time window — keep the one with better data.
      const iHasLoc = !!events[i].location;
      const jHasLoc = !!events[j].location;
      const iDescLen = events[i].description?.length ?? 0;
      const jDescLen = events[j].description?.length ?? 0;

      if (jHasLoc && !iHasLoc) {
        toDelete.add(events[i].id);
        break; // i is deleted, move on
      } else if (iHasLoc && !jHasLoc) {
        toDelete.add(events[j].id);
      } else if (jDescLen > iDescLen) {
        toDelete.add(events[i].id);
        break;
      } else {
        toDelete.add(events[j].id);
      }
    }
  }

  if (toDelete.size > 0) {
    await prisma.trackingEvent.deleteMany({
      where: { id: { in: [...toDelete] } },
    });
  }
}
