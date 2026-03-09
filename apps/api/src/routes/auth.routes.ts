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
  getGitHubAuthUrl,
  exchangeGitHubCode,
  getAppleAuthUrl,
  exchangeAppleCode,
} from "../services/auth.service.js";
import { exchangeGmailCode } from "../services/gmail.service.js";
import { encrypt } from "../lib/encryption.js";
import { EmailProvider } from "@mailtrack/shared";

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

  // GET /api/auth/google/callback — Handle Google OAuth callback (login + Gmail connect)
  app.get("/google/callback", async (request, reply) => {
    const { code, error, state } = request.query as { code?: string; error?: string; state?: string };

    // Parse state to determine flow type
    let flow = "login";
    let userToken: string | undefined;
    let returnTo: string | undefined;
    if (state) {
      try {
        const parsed = JSON.parse(state);
        if (parsed.flow === "gmail") {
          flow = "gmail";
          userToken = parsed.token;
          returnTo = parsed.returnTo;
        }
      } catch {
        // Not JSON state — treat as login flow
      }
    }

    if (error || !code) {
      const redirectUrl = flow === "gmail" ? `${WEB_URL}${returnTo ?? "/settings"}` : `${WEB_URL}/login`;
      return reply.redirect(`${redirectUrl}?error=${encodeURIComponent(error ?? "No authorization code received")}`);
    }

    // === Gmail connect flow ===
    if (flow === "gmail" && userToken) {
      const redirectBase = `${WEB_URL}${returnTo ?? "/settings"}`;
      let userId: string;
      try {
        const decoded = app.jwt.verify(userToken) as { userId: string };
        userId = decoded.userId;
      } catch {
        return reply.redirect(`${redirectBase}?error=${encodeURIComponent("Session expired. Please log in again.")}`);
      }

      try {
        const tokens = await exchangeGmailCode(code);
        if (!tokens.access_token) {
          return reply.redirect(`${redirectBase}?error=${encodeURIComponent("Failed to get Gmail access token")}`);
        }

        // Get user's email from Gmail
        const { google } = await import("googleapis");
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: tokens.access_token });
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const profile = await gmail.users.getProfile({ userId: "me" });
        const email = profile.data.emailAddress ?? "";

        // Store encrypted tokens
        await app.prisma.connectedEmail.upsert({
          where: { userId_email: { userId, email } },
          update: {
            accessToken: encrypt(tokens.access_token),
            refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
          },
          create: {
            userId,
            provider: EmailProvider.GMAIL as any,
            email,
            accessToken: encrypt(tokens.access_token),
            refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
          },
        });

        await logAudit(app, userId, "EMAIL_CONNECT", "Gmail: " + email, request.ip);
        return reply.redirect(`${redirectBase}?success=${encodeURIComponent("Gmail connected: " + email)}&autoSync=1`);
      } catch (err: any) {
        app.log.error(err, "Gmail OAuth callback failed");
        return reply.redirect(`${redirectBase}?error=${encodeURIComponent("Failed to connect Gmail. Please try again.")}`);
      }
    }

    // === Login flow ===
    try {
      const payload = await exchangeGoogleCode(code);

      const user = await findOrCreateUser(app, {
        email: payload.email,
        name: payload.name,
        avatar: payload.picture ?? null,
        authProvider: AuthProvider.GOOGLE,
        givenName: payload.givenName,
        familyName: payload.familyName,
        locale: payload.locale,
        googleId: payload.sub,
        emailVerified: payload.emailVerified,
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

      return reply.redirect(`${WEB_URL}/auth/callback?token=${tokens.accessToken}`);
    } catch (err: any) {
      app.log.error(err, "Google OAuth callback failed");
      return reply.redirect(`${WEB_URL}/login?error=${encodeURIComponent("Authentication failed. Please try again.")}`);
    }
  });

  // POST /api/auth/dev-login — Quick login without OAuth
  if (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_LOGIN === "true") {
    app.post("/dev-login", async (request, reply) => {
      const body = request.body as { email?: string } | undefined;
      const email = body?.email || "michaelmichaeli888@gmail.com";
      const user = await findOrCreateUser(app, {
        email,
        name: email === "michaelmichaeli888@gmail.com" ? "Michael Michaeli" : "Dev User",
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

  // ─── GitHub OAuth ───

  // GET /api/auth/github — Redirect to GitHub OAuth
  app.get("/github", async (_request, reply) => {
    try {
      const url = getGitHubAuthUrl();
      return reply.redirect(url);
    } catch (err: any) {
      return reply.redirect(`${WEB_URL}/login?error=${encodeURIComponent(err.message)}`);
    }
  });

  // GET /api/auth/github/callback — Handle GitHub OAuth callback
  app.get("/github/callback", async (request, reply) => {
    const { code, error } = request.query as { code?: string; error?: string };

    if (error || !code) {
      return reply.redirect(`${WEB_URL}/login?error=${encodeURIComponent(error ?? "No authorization code received")}`);
    }

    try {
      const payload = await exchangeGitHubCode(code);

      const user = await findOrCreateUser(app, {
        email: payload.email,
        name: payload.name,
        avatar: payload.avatar,
        authProvider: AuthProvider.GITHUB,
        githubId: payload.sub,
        emailVerified: true,
      });

      const tokens = await generateTokens(app, user.id);
      await logAudit(app, user.id, "LOGIN", "Provider: GITHUB (OAuth)", request.ip);

      reply.setCookie("refreshToken", tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth",
        maxAge: 30 * 24 * 60 * 60,
      });

      return reply.redirect(`${WEB_URL}/auth/callback?token=${tokens.accessToken}`);
    } catch (err: any) {
      app.log.error(err, "GitHub OAuth callback failed");
      return reply.redirect(`${WEB_URL}/login?error=${encodeURIComponent("GitHub authentication failed. Please try again.")}`);
    }
  });

  // ─── Apple Sign-In ───

  // GET /api/auth/apple — Redirect to Apple Sign-In
  app.get("/apple", async (_request, reply) => {
    try {
      const url = getAppleAuthUrl();
      return reply.redirect(url);
    } catch (err: any) {
      return reply.redirect(`${WEB_URL}/login?error=${encodeURIComponent(err.message)}`);
    }
  });

  // POST /api/auth/apple/callback — Handle Apple Sign-In callback (form_post)
  app.post("/apple/callback", async (request, reply) => {
    const body = request.body as { code?: string; id_token?: string; user?: string; error?: string };

    if (body.error || !body.code) {
      return reply.redirect(`${WEB_URL}/login?error=${encodeURIComponent(body.error ?? "Apple Sign-In failed")}`);
    }

    try {
      const payload = await exchangeAppleCode(body.code);

      // Apple sends user info only on first authorization
      let name = payload.name;
      if (body.user) {
        try {
          const userData = JSON.parse(body.user);
          if (userData.name) {
            name = [userData.name.firstName, userData.name.lastName].filter(Boolean).join(" ") || name;
          }
        } catch { /* ignore parse errors */ }
      }

      const user = await findOrCreateUser(app, {
        email: payload.email,
        name,
        authProvider: AuthProvider.APPLE,
        appleId: payload.sub,
        emailVerified: true,
      });

      const tokens = await generateTokens(app, user.id);
      await logAudit(app, user.id, "LOGIN", "Provider: APPLE (OAuth)", request.ip);

      reply.setCookie("refreshToken", tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth",
        maxAge: 30 * 24 * 60 * 60,
      });

      return reply.redirect(`${WEB_URL}/auth/callback?token=${tokens.accessToken}`);
    } catch (err: any) {
      app.log.error(err, "Apple Sign-In callback failed");
      return reply.redirect(`${WEB_URL}/login?error=${encodeURIComponent("Apple authentication failed. Please try again.")}`);
    }
  });

  // ─── Passkey / WebAuthn ───

  // POST /api/auth/passkey/register-options — Get registration options (authenticated)
  app.post("/passkey/register-options", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;
    const user = await app.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    const existingPasskeys = await app.prisma.passkey.findMany({ where: { userId } });

    const { generateRegistrationOptions } = await import("@simplewebauthn/server");
    const options = await generateRegistrationOptions({
      rpName: "MailTrack",
      rpID: getRpId(),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: "none",
      excludeCredentials: existingPasskeys.map((p) => ({
        id: p.credentialId,
        transports: p.transports ? JSON.parse(p.transports) : undefined,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    // Store challenge in a short-lived key
    await app.redis.set(`passkey:challenge:${userId}`, options.challenge, "EX", 300);

    return options;
  });

  // POST /api/auth/passkey/register — Verify and store passkey (authenticated)
  app.post("/passkey/register", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.user.userId;
    const body = request.body as any;
    const friendlyName = body.friendlyName ?? "Passkey";

    const expectedChallenge = await app.redis.get(`passkey:challenge:${userId}`);
    if (!expectedChallenge) {
      return reply.status(400).send({ message: "Challenge expired. Please try again." });
    }

    try {
      const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
      const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: getExpectedOrigin(),
        expectedRPID: getRpId(),
      });

      if (!verification.verified || !verification.registrationInfo) {
        return reply.status(400).send({ message: "Passkey verification failed" });
      }

      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

      await app.prisma.passkey.create({
        data: {
          userId,
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey).toString("base64url"),
          counter: BigInt(credential.counter),
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          transports: body.response?.transports ? JSON.stringify(body.response.transports) : null,
          friendlyName,
        },
      });

      await app.redis.del(`passkey:challenge:${userId}`);
      await logAudit(app, userId, "PASSKEY_REGISTER", `Name: ${friendlyName}`, request.ip);

      return { success: true, message: "Passkey registered successfully" };
    } catch (err: any) {
      app.log.error(err, "Passkey registration failed");
      return reply.status(400).send({ message: err.message ?? "Passkey registration failed" });
    }
  });

  // POST /api/auth/passkey/login-options — Get authentication options (unauthenticated)
  app.post("/passkey/login-options", async (request) => {
    const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
    const options = await generateAuthenticationOptions({
      rpID: getRpId(),
      userVerification: "preferred",
    });

    // Store challenge keyed by itself (no user context yet)
    await app.redis.set(`passkey:login-challenge:${options.challenge}`, "1", "EX", 300);

    return options;
  });

  // POST /api/auth/passkey/login — Verify passkey and login (unauthenticated)
  app.post("/passkey/login", async (request, reply) => {
    const body = request.body as any;

    const passkey = await app.prisma.passkey.findUnique({
      where: { credentialId: body.id },
      include: { user: true },
    });

    if (!passkey) {
      return reply.status(401).send({ error: "Passkey not recognized" });
    }

    // Extract challenge from clientDataJSON to verify against stored challenge
    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");

    // Find the challenge — decode clientDataJSON to get it
    const clientData = JSON.parse(Buffer.from(body.response.clientDataJSON, "base64url").toString());
    const storedChallenge = await app.redis.get(`passkey:login-challenge:${clientData.challenge}`);
    if (!storedChallenge) {
      return reply.status(401).send({ error: "Challenge expired. Please try again." });
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: clientData.challenge,
      expectedOrigin: getExpectedOrigin(),
      expectedRPID: getRpId(),
      credential: {
        id: passkey.credentialId,
        publicKey: Buffer.from(passkey.publicKey, "base64url"),
        counter: Number(passkey.counter),
        transports: passkey.transports ? JSON.parse(passkey.transports) : undefined,
      },
    });

    if (!verification.verified) {
      return reply.status(401).send({ error: "Passkey verification failed" });
    }

    // Update counter
    await app.prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    await app.redis.del(`passkey:login-challenge:${clientData.challenge}`);

    const tokens = await generateTokens(app, passkey.userId);
    await logAudit(app, passkey.userId, "LOGIN", "Provider: PASSKEY", request.ip);

    reply.setCookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
      maxAge: 30 * 24 * 60 * 60,
    });

    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: passkey.user.id,
        name: passkey.user.name,
        email: passkey.user.email,
        avatar: passkey.user.avatar,
        authProvider: passkey.user.authProvider,
        createdAt: passkey.user.createdAt.toISOString(),
        updatedAt: passkey.user.updatedAt.toISOString(),
      },
    };
  });

  // GET /api/auth/passkeys — List user's passkeys (authenticated)
  app.get("/passkeys", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const passkeys = await app.prisma.passkey.findMany({
      where: { userId: request.user.userId },
      select: { id: true, friendlyName: true, createdAt: true, deviceType: true, backedUp: true },
      orderBy: { createdAt: "desc" },
    });
    return passkeys;
  });

  // DELETE /api/auth/passkeys/:id — Remove a passkey (authenticated)
  app.delete("/passkeys/:id", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const passkey = await app.prisma.passkey.findFirst({
      where: { id, userId: request.user.userId },
    });
    if (!passkey) return reply.status(404).send({ error: "Passkey not found" });

    await app.prisma.passkey.delete({ where: { id } });
    await logAudit(app, request.user.userId, "PASSKEY_DELETE", `Name: ${passkey.friendlyName}`, request.ip);
    return { success: true };
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
      givenName: user.givenName,
      familyName: user.familyName,
      locale: user.locale,
      googleId: user.googleId,
      emailVerified: user.emailVerified,
      authProvider: user.authProvider,
      onboardingCompleted: user.onboardingCompleted,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      connectedEmails: user.connectedEmails,
      connectedShops: user.connectedShops,
      notificationPreference: user.notificationPreference,
    };
  });

  // POST /api/auth/onboarding-complete — Mark onboarding as done
  app.post("/onboarding-complete", {
    preHandler: [app.authenticate],
  }, async (request) => {
    await app.prisma.user.update({
      where: { id: request.user.userId },
      data: { onboardingCompleted: true },
    });
    return { success: true };
  });

  // PATCH /api/auth/me — Update current user profile
  app.patch("/me", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const { name } = request.body as { name?: string };
    const data: Record<string, string> = {};
    if (name && name.trim()) data.name = name.trim();

    if (Object.keys(data).length === 0) {
      return { success: false, message: "No fields to update" };
    }

    const user = await app.prisma.user.update({
      where: { id: request.user.userId },
      data,
    });
    return { success: true, name: user.name };
  });

  // GET /api/auth/stats — Get user usage statistics
  app.get("/stats", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = request.user.userId;

    const [
      totalOrders,
      totalPackages,
      deliveredPackages,
      inTransitPackages,
      totalEvents,
      totalNotifications,
      connectedEmailCount,
    ] = await Promise.all([
      app.prisma.order.count({ where: { userId } }),
      app.prisma.package.count({ where: { order: { userId } } }),
      app.prisma.package.count({ where: { order: { userId }, status: "DELIVERED" } }),
      app.prisma.package.count({ where: { order: { userId }, status: { in: ["IN_TRANSIT", "OUT_FOR_DELIVERY"] } } }),
      app.prisma.trackingEvent.count({ where: { package: { order: { userId } } } }),
      app.prisma.notification.count({ where: { userId } }),
      app.prisma.connectedEmail.count({ where: { userId } }),
    ]);

    // Unique carriers used
    const carriers = await app.prisma.package.groupBy({
      by: ["carrier"],
      where: { order: { userId } },
    });

    // Unique stores/merchants
    const stores = await app.prisma.order.groupBy({
      by: ["merchant"],
      where: { userId },
    });

    return {
      totalOrders,
      totalPackages,
      deliveredPackages,
      inTransitPackages,
      totalEvents,
      totalNotifications,
      connectedEmailCount,
      uniqueCarriers: carriers.length,
      uniqueStores: stores.length,
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

// ─── Helpers ───

function getRpId(): string {
  const webUrl = process.env.WEB_URL ?? "http://localhost:3003";
  try {
    return new URL(webUrl).hostname;
  } catch {
    return "localhost";
  }
}

function getExpectedOrigin(): string[] {
  const webUrl = process.env.WEB_URL ?? "http://localhost:3003";
  const origins = [webUrl];
  // Support both www and non-www variants, and ios/android app origins
  try {
    const url = new URL(webUrl);
    if (url.hostname.startsWith("www.")) {
      origins.push(`${url.protocol}//${url.hostname.slice(4)}${url.port ? `:${url.port}` : ""}`);
    } else {
      origins.push(`${url.protocol}//www.${url.hostname}${url.port ? `:${url.port}` : ""}`);
    }
  } catch {}
  if (process.env.PASSKEY_EXTRA_ORIGINS) {
    origins.push(...process.env.PASSKEY_EXTRA_ORIGINS.split(",").map(o => o.trim()));
  }
  return origins;
}
