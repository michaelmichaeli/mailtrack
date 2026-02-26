import type { FastifyPluginAsync } from "fastify";
import { updateNotificationPreferenceSchema } from "@mailtrack/shared";
import { getVapidPublicKey } from "../services/notification.service.js";

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/settings/notifications — Get notification preferences
  app.get("/notifications", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;

    const prefs = await app.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      // Create default preferences
      return app.prisma.notificationPreference.create({
        data: { userId, pushEnabled: true, emailEnabled: false },
      });
    }

    return prefs;
  });

  // PATCH /api/settings/notifications — Update notification preferences
  app.patch("/notifications", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;
    const data = updateNotificationPreferenceSchema.parse(request.body);

    const prefs = await app.prisma.notificationPreference.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data, pushEnabled: data.pushEnabled ?? true, emailEnabled: data.emailEnabled ?? false },
    });

    return prefs;
  });

  // PUT /api/settings/notifications/push-token — Update push token
  app.put("/notifications/push-token", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;
    const { token } = request.body as { token: string };

    await app.prisma.notificationPreference.upsert({
      where: { userId },
      update: { pushToken: token },
      create: { userId, pushEnabled: true, emailEnabled: false, pushToken: token },
    });

    return { success: true };
  });

  // GET /api/settings/vapid-key — Get the VAPID public key for Web Push subscription
  app.get("/vapid-key", async () => {
    return { publicKey: getVapidPublicKey() };
  });

  // POST /api/settings/notifications/subscribe — Save Web Push subscription
  app.post("/notifications/subscribe", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;
    const { subscription } = request.body as { subscription: any };

    if (!subscription) {
      return { success: false, error: "Missing subscription" };
    }

    await app.prisma.notificationPreference.upsert({
      where: { userId },
      update: { pushSubscription: JSON.stringify(subscription), pushEnabled: true },
      create: { userId, pushEnabled: true, emailEnabled: false, pushSubscription: JSON.stringify(subscription) },
    });

    return { success: true };
  });

  // POST /api/settings/notifications/unsubscribe — Remove Web Push subscription
  app.post("/notifications/unsubscribe", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;

    await app.prisma.notificationPreference.upsert({
      where: { userId },
      update: { pushSubscription: null, pushEnabled: false },
      create: { userId, pushEnabled: false, emailEnabled: false },
    });

    return { success: true };
  });

  // GET /api/settings/connected-accounts — Get all connected accounts
  app.get("/connected-accounts", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;

    const [emails, shops] = await Promise.all([
      app.prisma.connectedEmail.findMany({
        where: { userId },
        select: { id: true, provider: true, email: true, lastSyncAt: true, createdAt: true },
      }),
      app.prisma.connectedShop.findMany({
        where: { userId },
        select: { id: true, platform: true, createdAt: true },
      }),
    ]);

    return { emails, shops };
  });
};
