import type { FastifyPluginAsync } from "fastify";

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/notifications — list notifications (with pagination + unread filter)
  app.get("/", { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { page = "1", limit = "20", unreadOnly = "false" } = request.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    const where: any = { userId };
    if (unreadOnly === "true") where.read = false;

    const [items, total, unreadCount] = await Promise.all([
      app.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      app.prisma.notification.count({ where }),
      app.prisma.notification.count({ where: { userId, read: false } }),
    ]);

    return {
      items: items.map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        icon: n.icon,
        orderId: n.orderId,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
      total,
      unreadCount,
      page: pageNum,
      limit: limitNum,
    };
  });

  // GET /api/notifications/unread-count — lightweight poll endpoint
  app.get("/unread-count", { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const count = await app.prisma.notification.count({ where: { userId, read: false } });
    return { unreadCount: count };
  });

  // PATCH /api/notifications/:id/read — mark single as read
  app.patch("/:id/read", { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };

    await app.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });

    return { success: true };
  });

  // POST /api/notifications/mark-all-read — mark all as read
  app.post("/mark-all-read", { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;

    const result = await app.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return { success: true, updated: result.count };
  });

  // DELETE /api/notifications/:id — delete single
  app.delete("/:id", { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };

    await app.prisma.notification.deleteMany({
      where: { id, userId },
    });

    return { success: true };
  });

  // DELETE /api/notifications — clear all
  app.delete("/", { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;

    const result = await app.prisma.notification.deleteMany({
      where: { userId },
    });

    return { success: true, deleted: result.count };
  });
};
