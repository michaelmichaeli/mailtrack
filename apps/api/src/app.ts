import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
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
    ajv: { customOptions: { removeAdditional: true } },
  });

  // Allow empty bodies for DELETE requests (Fastify rejects empty JSON by default)
  app.addHook("onRequest", async (request) => {
    if (request.method === "DELETE") {
      delete request.headers["content-type"];
    }
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
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Cookies (for refresh tokens). Reuse JWT_SECRET — already validated by jwt plugin.
  // In dev with no env, fall back to a clearly-marked placeholder.
  const cookieSecret = process.env.JWT_SECRET ??
    (process.env.NODE_ENV === "production"
      ? (() => { throw new Error("JWT_SECRET required for cookie signing in production"); })()
      : "dev-cookie-secret-do-not-use-in-prod");
  await app.register(cookie, { secret: cookieSecret });

  // Security headers (CSP, frameguard, HSTS, etc.)
  await app.register(helmet, {
    // The web app sets its own CSP; don't double-up here. Keep core defenses.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  // Global rate limiting. Per-route configs (see e.g. ingest.routes.ts and
  // auth) override this with tighter or per-key limits.
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
    // Skip the health check from rate-limit accounting.
    skipOnError: true,
    keyGenerator: (req) =>
      (req.headers["x-ingest-key"] as string) ||
      (req.headers.authorization as string) ||
      req.ip,
  });

  // Plugins
  await app.register(prismaPlugin);
  await app.register(jwtPlugin);
  await app.register(redisPlugin);

  // Accept plain text bodies (for SMS ingestion from iOS Shortcuts)
  app.addContentTypeParser("text/plain", { parseAs: "string" }, (_req, body, done) => {
    done(null, body);
  });

  // Accept form-urlencoded bodies (some iOS Shortcuts send this format)
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, body, done) => {
    try {
      const params = new URLSearchParams(body as string);
      const obj: Record<string, string> = {};
      for (const [k, v] of params) obj[k] = v;
      done(null, obj);
    } catch {
      done(null, body);
    }
  });

  // Routes
  await app.register(registerRoutes, { prefix: "/api" });

  // Health check — verifies DB connectivity so Railway restarts on real failures
  app.get("/health", async (request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", timestamp: new Date().toISOString(), version: "2026-03-07e" };
    } catch (err) {
      app.log.error(`[health] DB check failed: ${(err as Error).message}`);
      return reply.status(503).send({
        status: "unhealthy",
        error: "database unreachable",
        timestamp: new Date().toISOString(),
      });
    }
  });

  return app;
}
