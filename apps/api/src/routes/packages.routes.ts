import type { FastifyPluginAsync } from "fastify";
import { searchParamsSchema } from "@mailtrack/shared";
import { trackPackage } from "../services/tracking.service.js";

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
        { packages: { some: { trackingNumber: { contains: params.query, mode: "insensitive" } } } },
        { packages: { some: { items: { contains: params.query, mode: "insensitive" } } } },
      ];
    }
    if (params.status) {
      where.packages = { some: { status: params.status } };
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

  // POST /api/packages/:id/refresh — Refresh tracking info
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

    // Fetch latest tracking info
    const result = await trackPackage(pkg.trackingNumber, pkg.carrier as any);

    if (result) {
      // Update package
      await app.prisma.package.update({
        where: { id },
        data: {
          status: result.status as any,
          estimatedDelivery: result.estimatedDelivery ? new Date(result.estimatedDelivery) : null,
          lastLocation: result.lastLocation,
        },
      });

      // Add new events
      for (const event of result.events) {
        const exists = await app.prisma.trackingEvent.findFirst({
          where: {
            packageId: id,
            timestamp: new Date(event.timestamp),
            description: event.description,
          },
        });

        if (!exists) {
          await app.prisma.trackingEvent.create({
            data: {
              packageId: id,
              timestamp: new Date(event.timestamp),
              location: event.location,
              status: event.status as any,
              description: event.description,
            },
          });
        }
      }
    }

    return { success: true, updated: !!result };
  });
};
