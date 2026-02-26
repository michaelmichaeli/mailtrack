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
      where.OR = [
        { merchant: { contains: params.query, mode: "insensitive" } },
        { externalOrderId: { contains: params.query, mode: "insensitive" } },
        { items: { contains: params.query, mode: "insensitive" } },
        { packages: { some: { trackingNumber: { contains: params.query, mode: "insensitive" } } } },
        { packages: { some: { items: { contains: params.query, mode: "insensitive" } } } },
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
      where.createdAt = {};
      if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
      if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
    }

    const [items, total] = await Promise.all([
      app.prisma.order.findMany({
        where,
        include: {
          packages: {
            include: { events: { orderBy: { timestamp: "desc" }, take: 1 } },
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
        return {
          id: o.id,
          externalOrderId: o.externalOrderId,
          shopPlatform: o.shopPlatform,
          merchant: o.merchant,
          orderDate: o.orderDate?.toISOString() ?? null,
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

    const result = await trackPackage(pkg.trackingNumber, pkg.carrier as any);

    if (result) {
      await syncPackageFromResult(app.prisma, id, result);
    }

    return { success: true, updated: !!result };
  });

  // POST /api/packages/sync-all — Refresh all non-delivered packages from Cainiao
  app.post("/sync-all", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;

    const packages = await app.prisma.package.findMany({
      where: { order: { userId } },
      select: { id: true, trackingNumber: true, carrier: true, status: true },
    });

    let synced = 0;
    let errors = 0;

    // Process sequentially with 1.5s delay to avoid rate limiting
    for (const pkg of packages) {
      try {
        const result = await trackPackage(pkg.trackingNumber, pkg.carrier as any);
        if (result) {
          await syncPackageFromResult(app.prisma, pkg.id, result);
          synced++;
        }
      } catch (e) {
        errors++;
        console.error(`[sync-all] Error syncing ${pkg.trackingNumber}:`, e);
      }
      // Delay between requests to avoid Cainiao rate limiting
      await new Promise((r) => setTimeout(r, 1500));
    }

    return { success: true, synced, errors, total: packages.length };
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
      return reply.status(409).send({ error: "Package already tracked", packageId: existing.id, orderId: existing.orderId });
    }

    // Auto-detect carrier if not provided
    const { detectCarrier } = await import("../lib/carrier-detect.js");
    const detectedCarrier = carrier || detectCarrier(tn);

    // Create an order + package for the manual entry
    const order = await app.prisma.order.create({
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
            carrier: detectedCarrier,
            status: "PROCESSING",
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
    include: { order: { select: { userId: true } } },
  });
  const oldStatus = currentPkg?.status;

  // Update package status and location
  await prisma.package.update({
    where: { id: packageId },
    data: {
      status: result.status as any,
      ...(result.estimatedDelivery ? { estimatedDelivery: new Date(result.estimatedDelivery) } : {}),
      ...(result.lastLocation ? { lastLocation: result.lastLocation } : {}),
    },
  });

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

  // Upsert events — deduplicate by timestamp (within 2 seconds)
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
