import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { registerRoutes } from "./routes/index.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { jwtPlugin } from "./plugins/jwt.js";
import { redisPlugin } from "./plugins/redis.js";

const envToLogger: Record<string, object | boolean> = {
  development: {
    transport: {
      target: "pino-pretty",
      options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
    },
  },
  production: true,
  test: false,
};

export async function buildApp() {
  const app = Fastify({
    logger: envToLogger[process.env.NODE_ENV ?? "development"] ?? true,
  });

  // CORS
  await app.register(cors, {
    origin: [
      process.env.WEB_URL ?? "http://localhost:3003",
      "http://localhost:3000",
      "http://localhost:3003",
      /\.mailtrack\.app$/,
      /\.vercel\.app$/,
    ],
    credentials: true,
  });

  // Cookies (for refresh tokens)
  await app.register(cookie, {
    secret: process.env.JWT_SECRET ?? "dev-cookie-secret",
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // Plugins
  await app.register(prismaPlugin);
  await app.register(jwtPlugin);
  await app.register(redisPlugin);

  // Accept plain text bodies (for SMS ingestion from iOS Shortcuts)
  app.addContentTypeParser("text/plain", { parseAs: "string" }, (_req, body, done) => {
    done(null, body);
  });

  // Routes
  await app.register(registerRoutes, { prefix: "/api" });

  // Health check
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  return app;
}
