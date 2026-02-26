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
    const recentCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch all user packages with orders
    const packages = await app.prisma.package.findMany({
      where: {
        order: { userId },
      },
      include: {
        order: true,
        events: {
          orderBy: { timestamp: "desc" },
          take: 5,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Group by status
    const arrivingToday = packages.filter(
      (p: any) =>
        p.status === PackageStatus.OUT_FOR_DELIVERY ||
        (p.estimatedDelivery &&
          p.estimatedDelivery >= todayStart &&
          p.estimatedDelivery < todayEnd &&
          p.status !== PackageStatus.DELIVERED)
    );

    const inTransit = packages.filter(
      (p: any) =>
        p.status === PackageStatus.IN_TRANSIT ||
        p.status === PackageStatus.SHIPPED
    );

    const processing = packages.filter(
      (p: any) =>
        p.status === PackageStatus.ORDERED ||
        p.status === PackageStatus.PROCESSING
    );

    const delivered = packages.filter(
      (p: any) =>
        p.status === PackageStatus.DELIVERED &&
        p.updatedAt >= recentCutoff
    );

    const exceptions = packages.filter(
      (p: any) =>
        p.status === PackageStatus.EXCEPTION ||
        p.status === PackageStatus.RETURNED
    );

    const formatPackage = (p: Record<string, any>) => ({
      id: p.id,
      orderId: p.orderId,
      trackingNumber: p.trackingNumber,
      carrier: p.carrier,
      status: p.status,
      estimatedDelivery: p.estimatedDelivery?.toISOString() ?? null,
      lastLocation: p.lastLocation,
      items: p.items,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      order: {
        id: p.order.id,
        userId: p.order.userId,
        shopPlatform: p.order.shopPlatform,
        externalOrderId: p.order.externalOrderId,
        orderDate: p.order.orderDate?.toISOString() ?? null,
        merchant: p.order.merchant,
        totalAmount: p.order.totalAmount,
        currency: p.order.currency,
        createdAt: p.order.createdAt.toISOString(),
        updatedAt: p.order.updatedAt.toISOString(),
      },
      events: p.events.map((e: Record<string, any>) => ({
        id: e.id,
        packageId: e.packageId,
        timestamp: e.timestamp.toISOString(),
        location: e.location,
        status: e.status,
        description: e.description,
        createdAt: e.createdAt.toISOString(),
      })),
    });

    return {
      arrivingToday: arrivingToday.map(formatPackage),
      inTransit: inTransit.map(formatPackage),
      processing: processing.map(formatPackage),
      delivered: delivered.map(formatPackage),
      exceptions: exceptions.map(formatPackage),
      stats: {
        total: packages.length,
        arrivingToday: arrivingToday.length,
        inTransit: inTransit.length,
        processing: processing.length,
        delivered: delivered.length,
        exceptions: exceptions.length,
      },
    };
  });
};
