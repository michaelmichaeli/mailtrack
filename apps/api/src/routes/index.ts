import type { FastifyPluginAsync } from "fastify";
import { authRoutes } from "./auth.routes.js";
import { packageRoutes } from "./packages.routes.js";
import { orderRoutes } from "./orders.routes.js";
import { dashboardRoutes } from "./dashboard.routes.js";
import { emailRoutes } from "./email.routes.js";
import { settingsRoutes } from "./settings.routes.js";
import { webhookRoutes } from "./webhook.routes.js";
import { ingestRoutes } from "./ingest.routes.js";

export const registerRoutes: FastifyPluginAsync = async (app) => {
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(dashboardRoutes, { prefix: "/dashboard" });
  await app.register(packageRoutes, { prefix: "/packages" });
  await app.register(orderRoutes, { prefix: "/orders" });
  await app.register(emailRoutes, { prefix: "/email" });
  await app.register(settingsRoutes, { prefix: "/settings" });
  await app.register(webhookRoutes, { prefix: "/webhooks" });
  await app.register(ingestRoutes, { prefix: "/ingest" });
};
