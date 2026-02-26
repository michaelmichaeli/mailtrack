import type { FastifyPluginAsync } from "fastify";
import { PackageStatus } from "@mailtrack/shared";

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/dashboard — Get dashboard data
  app.get("/", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const recentCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all user orders with packages
    const orders = await app.prisma.order.findMany({
      where: { userId },
      include: {
        packages: {
          include: {
            events: {
              orderBy: { timestamp: "desc" },
              take: 3,
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Categorize orders
    const arrivingToday: any[] = [];
    const inTransit: any[] = [];
    const processing: any[] = [];
    const delivered: any[] = [];
    const exceptions: any[] = [];

    for (const order of orders) {
      const pkg = order.packages[0]; // primary package
      // Use order-level status for categorization
      const orderStatus = pkg?.status ?? order.status;

      if (pkg) {
        if (
          pkg.status === PackageStatus.OUT_FOR_DELIVERY ||
          (pkg.estimatedDelivery &&
            pkg.estimatedDelivery >= todayStart &&
            pkg.estimatedDelivery < todayEnd &&
            pkg.status !== PackageStatus.DELIVERED)
        ) {
          arrivingToday.push(order);
        } else if (
          pkg.status === PackageStatus.IN_TRANSIT ||
          pkg.status === PackageStatus.SHIPPED
        ) {
          inTransit.push(order);
        } else if (
          pkg.status === PackageStatus.DELIVERED
        ) {
          if (pkg.updatedAt >= recentCutoff) delivered.push(order);
        } else if (
          pkg.status === PackageStatus.EXCEPTION ||
          pkg.status === PackageStatus.RETURNED
        ) {
          exceptions.push(order);
        } else {
          processing.push(order);
        }
      } else {
        // No package — use order-level status
        if (orderStatus === PackageStatus.DELIVERED) {
          if (order.updatedAt >= recentCutoff) delivered.push(order);
        } else if (orderStatus === PackageStatus.IN_TRANSIT || orderStatus === PackageStatus.SHIPPED) {
          inTransit.push(order);
        } else if (orderStatus === PackageStatus.OUT_FOR_DELIVERY) {
          arrivingToday.push(order);
        } else if (order.createdAt >= recentCutoff) {
          processing.push(order);
        }
      }
    }

    const formatOrder = (o: Record<string, any>) => ({
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
      package: o.packages[0]
        ? {
            id: o.packages[0].id,
            trackingNumber: o.packages[0].trackingNumber,
            carrier: o.packages[0].carrier,
            status: o.packages[0].status,
            estimatedDelivery: o.packages[0].estimatedDelivery?.toISOString() ?? null,
            lastLocation: o.packages[0].lastLocation,
            items: o.packages[0].items,
            pickupLocation: o.packages[0].pickupLocation,
            events: o.packages[0].events.map((e: Record<string, any>) => ({
              id: e.id,
              timestamp: e.timestamp.toISOString(),
              location: e.location,
              status: e.status,
              description: e.description,
            })),
          }
        : null,
    });

    return {
      arrivingToday: arrivingToday.map(formatOrder),
      inTransit: inTransit.map(formatOrder),
      processing: processing.map(formatOrder),
      delivered: delivered.map(formatOrder),
      exceptions: exceptions.map(formatOrder),
      stats: {
        total: orders.length,
        arrivingToday: arrivingToday.length,
        inTransit: inTransit.length,
        processing: processing.length,
        delivered: delivered.length,
        exceptions: exceptions.length,
      },
    };
  });
};
