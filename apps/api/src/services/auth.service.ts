import { OAuth2Client } from "google-auth-library";
import type { FastifyInstance } from "fastify";
import type { AuthProvider } from "@mailtrack/shared";
import crypto from "node:crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const API_URL = process.env.API_URL ?? "http://localhost:3002";

const googleClient = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  `${API_URL}/api/auth/google/callback`
);

interface GooglePayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

/**
 * Generate Google OAuth consent URL.
 */
export function getGoogleAuthUrl(): string {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured. Add it to your .env file.");
  }
  return googleClient.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    prompt: "consent",
  });
}

/**
 * Exchange Google OAuth authorization code for user info.
 */
export async function exchangeGoogleCode(code: string): Promise<GooglePayload> {
  const { tokens } = await googleClient.getToken(code);
  googleClient.setCredentials(tokens);

  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token!,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email || !payload.sub) {
    throw new Error("Invalid Google token payload");
  }
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email.split("@")[0],
    picture: payload.picture,
  };
}

/**
 * Verify Google ID token and extract user info.
 */
export async function verifyGoogleToken(idToken: string): Promise<GooglePayload> {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email || !payload.sub) {
    throw new Error("Invalid Google token payload");
  }
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email.split("@")[0],
    picture: payload.picture,
  };
}

/**
 * Verify Apple ID token (simplified — in production, use apple-signin-auth library).
 */
export async function verifyAppleToken(idToken: string): Promise<{ sub: string; email: string; name: string }> {
  // In production, decode and verify against Apple's public keys
  // For now, decode the JWT payload
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid Apple token");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email?.split("@")[0] ?? "User",
  };
}

/**
 * Find or create user from OAuth data.
 */
export async function findOrCreateUser(
  app: FastifyInstance,
  data: { email: string; name: string; avatar?: string | null; authProvider: AuthProvider }
) {
  let user = await app.prisma.user.findUnique({ where: { email: data.email } });

  if (!user) {
    user = await app.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        avatar: data.avatar ?? null,
        authProvider: data.authProvider,
        notificationPreference: {
          create: {
            pushEnabled: true,
            emailEnabled: false,
          },
        },
      },
    });
  }

  return user;
}

/**
 * Generate JWT tokens for a user.
 */
export async function generateTokens(app: FastifyInstance, userId: string) {
  const accessToken = app.jwt.sign({ userId }, { expiresIn: "15m" });

  // Create refresh token
  const refreshTokenValue = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await app.prisma.refreshToken.create({
    data: {
      userId,
      token: refreshTokenValue,
      expiresAt,
    },
  });

  return { accessToken, refreshToken: refreshTokenValue, expiresIn: 900 };
}

/**
 * Refresh access token using refresh token.
 */
export async function refreshAccessToken(app: FastifyInstance, refreshToken: string) {
  const stored = await app.prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date()) {
    // Clean up expired token if exists
    if (stored) {
      await app.prisma.refreshToken.delete({ where: { id: stored.id } });
    }
    throw new Error("Invalid or expired refresh token");
  }

  const accessToken = app.jwt.sign({ userId: stored.userId }, { expiresIn: "15m" });
  return { accessToken, expiresIn: 900, user: stored.user };
}

/**
 * Log an audit event.
 */
export async function logAudit(
  app: FastifyInstance,
  userId: string,
  action: string,
  details?: string,
  ipAddress?: string
) {
  await app.prisma.auditLog.create({
    data: { userId, action, details, ipAddress },
  });
}
