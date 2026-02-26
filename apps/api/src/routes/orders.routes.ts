import type { FastifyPluginAsync } from "fastify";

export const orderRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/orders/:id — Get order with all packages, events, and related orders
  app.get("/:id", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;

    const order = await app.prisma.order.findFirst({
      where: { id, userId },
      include: {
        packages: {
          include: { events: { orderBy: { timestamp: "desc" } } },
        },
      },
    });

    if (!order) {
      return reply.status(404).send({ error: "Order not found" });
    }

    // Find other orders sharing the same tracking numbers
    const trackingNumbers = order.packages
      .map((p: any) => p.trackingNumber)
      .filter(Boolean);

    let relatedOrders: any[] = [];
    if (trackingNumbers.length > 0) {
      relatedOrders = await app.prisma.order.findMany({
        where: {
          userId,
          id: { not: order.id },
          packages: { some: { trackingNumber: { in: trackingNumbers } } },
        },
        include: {
          packages: {
            include: { events: { orderBy: { timestamp: "desc" }, take: 1 } },
          },
        },
      });
    }

    return {
      id: order.id,
      externalOrderId: order.externalOrderId,
      shopPlatform: order.shopPlatform,
      merchant: order.merchant,
      orderDate: order.orderDate?.toISOString() ?? null,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      packages: order.packages.map((p: any) => ({
        id: p.id,
        trackingNumber: p.trackingNumber,
        carrier: p.carrier,
        status: p.status,
        estimatedDelivery: p.estimatedDelivery?.toISOString() ?? null,
        lastLocation: p.lastLocation,
        items: p.items,
        events: p.events.map((e: any) => ({
          id: e.id,
          packageId: e.packageId,
          timestamp: e.timestamp.toISOString(),
          location: e.location,
          status: e.status,
          description: e.description,
          createdAt: e.createdAt.toISOString(),
        })),
      })),
      relatedOrders: relatedOrders.map((ro: any) => ({
        id: ro.id,
        externalOrderId: ro.externalOrderId,
        merchant: ro.merchant,
        shopPlatform: ro.shopPlatform,
        orderDate: ro.orderDate?.toISOString() ?? null,
        totalAmount: ro.totalAmount,
        currency: ro.currency,
        packages: ro.packages.map((p: any) => ({
          id: p.id,
          trackingNumber: p.trackingNumber,
          carrier: p.carrier,
          status: p.status,
        })),
      })),
    };
  });
};
