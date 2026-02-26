import type { FastifyPluginAsync } from "fastify";
import { loginSchema } from "@mailtrack/shared";
import { AuthProvider } from "@mailtrack/shared";
import {
  verifyGoogleToken,
  verifyAppleToken,
  findOrCreateUser,
  generateTokens,
  refreshAccessToken,
  logAudit,
  getGoogleAuthUrl,
  exchangeGoogleCode,
} from "../services/auth.service.js";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3003";

export const authRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/auth/google — Redirect to Google OAuth consent screen
  // In dev mode without credentials, auto-login as dev user
  app.get("/google", async (request, reply) => {
    const hasCredentials = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== "your-google-client-id";

    if (!hasCredentials && process.env.NODE_ENV !== "production") {
      // Dev fallback: create user and redirect with token
      const user = await findOrCreateUser(app, {
        email: "dev@mailtrack.local",
        name: "Dev User",
        avatar: null,
        authProvider: "GOOGLE" as AuthProvider,
      });
      const tokens = await generateTokens(app, user.id);
      reply.setCookie("refreshToken", tokens.refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/api/auth",
        maxAge: 30 * 24 * 60 * 60,
      });
      return reply.redirect(`${WEB_URL}/auth/callback?token=${tokens.accessToken}`);
    }

    try {
      const url = getGoogleAuthUrl();
      return reply.redirect(url);
    } catch (err: any) {
      return reply.redirect(`${WEB_URL}/login?error=${encodeURIComponent(err.message)}`);
    }
  });

  // GET /api/auth/google/callback — Handle Google OAuth callback
  app.get("/google/callback", async (request, reply) => {
    const { code, error } = request.query as { code?: string; error?: string };

    if (error || !code) {
      return reply.redirect(`${WEB_URL}/login?error=${encodeURIComponent(error ?? "No authorization code received")}`);
    }

    try {
      const payload = await exchangeGoogleCode(code);

      const user = await findOrCreateUser(app, {
        email: payload.email,
        name: payload.name,
        avatar: payload.picture ?? null,
        authProvider: AuthProvider.GOOGLE,
      });

      const tokens = await generateTokens(app, user.id);

      await logAudit(app, user.id, "LOGIN", "Provider: GOOGLE (OAuth)", request.ip);

      reply.setCookie("refreshToken", tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth",
        maxAge: 30 * 24 * 60 * 60,
      });

      // Redirect to web app with the access token
      return reply.redirect(`${WEB_URL}/auth/callback?token=${tokens.accessToken}`);
    } catch (err: any) {
      app.log.error(err, "Google OAuth callback failed");
      return reply.redirect(`${WEB_URL}/login?error=${encodeURIComponent("Authentication failed. Please try again.")}`);
    }
  });

  // POST /api/auth/dev-login — Development-only login (no OAuth needed)
  if (process.env.NODE_ENV !== "production") {
    app.post("/dev-login", async (request, reply) => {
      const user = await findOrCreateUser(app, {
        email: "dev@mailtrack.local",
        name: "Dev User",
        avatar: null,
        authProvider: "GOOGLE" as AuthProvider,
      });

      const tokens = await generateTokens(app, user.id);

      reply.setCookie("refreshToken", tokens.refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/api/auth",
        maxAge: 30 * 24 * 60 * 60,
      });

      return {
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          authProvider: user.authProvider,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      };
    });
  }

  // POST /api/auth/login — Social login (Google/Apple)
  app.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    let email: string;
    let name: string;
    let avatar: string | null = null;

    if (body.provider === AuthProvider.GOOGLE) {
      const payload = await verifyGoogleToken(body.idToken);
      email = payload.email;
      name = payload.name;
      avatar = payload.picture ?? null;
    } else if (body.provider === AuthProvider.APPLE) {
      const payload = await verifyAppleToken(body.idToken);
      email = payload.email;
      name = payload.name;
    } else {
      return reply.status(400).send({ error: "Unsupported auth provider" });
    }

    const user = await findOrCreateUser(app, {
      email,
      name,
      avatar,
      authProvider: body.provider as AuthProvider,
    });

    const tokens = await generateTokens(app, user.id);

    await logAudit(app, user.id, "LOGIN", `Provider: ${body.provider}`, request.ip);

    // Set refresh token as httpOnly cookie
    reply.setCookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        authProvider: user.authProvider,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  });

  // POST /api/auth/refresh — Refresh access token
  app.post("/refresh", async (request, reply) => {
    const refreshToken =
      (request.cookies as any)?.refreshToken ??
      (request.body as any)?.refreshToken;

    if (!refreshToken) {
      return reply.status(401).send({ error: "No refresh token provided" });
    }

    try {
      const result = await refreshAccessToken(app, refreshToken);
      return {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          avatar: result.user.avatar,
          authProvider: result.user.authProvider,
          createdAt: result.user.createdAt.toISOString(),
          updatedAt: result.user.updatedAt.toISOString(),
        },
      };
    } catch {
      return reply.status(401).send({ error: "Invalid refresh token" });
    }
  });

  // POST /api/auth/logout — Logout
  app.post("/logout", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.user.userId;

    // Delete refresh token from cookie
    const refreshToken = (request.cookies as any)?.refreshToken;
    if (refreshToken) {
      await app.prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }

    reply.clearCookie("refreshToken", { path: "/api/auth" });

    await logAudit(app, userId, "LOGOUT", undefined, request.ip);

    return { success: true };
  });

  // GET /api/auth/me — Get current user
  app.get("/me", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.user.userId },
      include: {
        connectedEmails: { select: { id: true, provider: true, email: true, lastSyncAt: true } },
        connectedShops: { select: { id: true, platform: true, createdAt: true } },
        notificationPreference: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      authProvider: user.authProvider,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      connectedEmails: user.connectedEmails,
      connectedShops: user.connectedShops,
      notificationPreference: user.notificationPreference,
    };
  });

  // DELETE /api/auth/account — Delete account (GDPR right to be forgotten)
  app.delete("/account", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.user.userId;

    await logAudit(app, userId, "ACCOUNT_DELETE", "User requested account deletion", request.ip);

    // Cascade delete handles all related data
    await app.prisma.user.delete({ where: { id: userId } });

    reply.clearCookie("refreshToken", { path: "/api/auth" });

    return { success: true, message: "Account and all associated data deleted" };
  });

  // GET /api/auth/export — Export user data (GDPR)
  app.get("/export", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;

    const data = await app.prisma.user.findUnique({
      where: { id: userId },
      include: {
        connectedEmails: { select: { provider: true, email: true, lastSyncAt: true } },
        connectedShops: { select: { platform: true, createdAt: true } },
        orders: {
          include: {
            packages: {
              include: { events: true },
            },
          },
        },
        notificationPreference: true,
      },
    });

    return data;
  });
};
