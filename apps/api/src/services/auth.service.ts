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
  givenName?: string;
  familyName?: string;
  locale?: string;
  emailVerified?: boolean;
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
    givenName: payload.given_name,
    familyName: payload.family_name,
    locale: payload.locale,
    emailVerified: payload.email_verified,
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
    givenName: payload.given_name,
    familyName: payload.family_name,
    locale: payload.locale,
    emailVerified: payload.email_verified,
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

// ─── GitHub OAuth ───

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

export function getGitHubAuthUrl(): string {
  if (!GITHUB_CLIENT_ID) throw new Error("GITHUB_CLIENT_ID is not configured.");
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${API_URL}/api/auth/github/callback`,
    scope: "read:user user:email",
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export async function exchangeGitHubCode(code: string): Promise<{ sub: string; email: string; name: string; avatar: string }> {
  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
  if (!tokenData.access_token) throw new Error(tokenData.error ?? "Failed to get GitHub access token");

  // Get user profile
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
  });
  const ghUser = await userRes.json() as GitHubUser;

  // Get primary email if not public
  let email = ghUser.email;
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
    });
    const emails = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
    const primary = emails.find((e) => e.primary && e.verified) ?? emails[0];
    email = primary?.email ?? null;
  }

  if (!email) throw new Error("Could not get email from GitHub account");

  return {
    sub: String(ghUser.id),
    email,
    name: ghUser.name ?? ghUser.login,
    avatar: ghUser.avatar_url,
  };
}

// ─── Apple Sign-In (Web OAuth) ───

const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID; // Services ID (e.g., com.mailtrack.web)
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY; // PEM string

export function getAppleAuthUrl(): string {
  if (!APPLE_CLIENT_ID) throw new Error("APPLE_CLIENT_ID is not configured.");
  const params = new URLSearchParams({
    client_id: APPLE_CLIENT_ID,
    redirect_uri: `${API_URL}/api/auth/apple/callback`,
    response_type: "code id_token",
    scope: "name email",
    response_mode: "form_post",
  });
  return `https://appleid.apple.com/auth/authorize?${params}`;
}

function generateAppleClientSecret(): string {
  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY || !APPLE_CLIENT_ID) {
    throw new Error("Apple Sign-In not fully configured");
  }
  // Build JWT client secret
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: APPLE_KEY_ID })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: APPLE_TEAM_ID,
    iat: now,
    exp: now + 15777000, // ~6 months
    aud: "https://appleid.apple.com",
    sub: APPLE_CLIENT_ID,
  })).toString("base64url");

  // Sign with ES256 using Node crypto
  const sign = crypto.createSign("SHA256");
  sign.update(`${header}.${payload}`);
  const key = APPLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const sig = sign.sign({ key, dsaEncoding: "ieee-p1363" }, "base64url");
  return `${header}.${payload}.${sig}`;
}

export async function exchangeAppleCode(code: string): Promise<{ sub: string; email: string; name: string }> {
  const clientSecret = generateAppleClientSecret();

  const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: APPLE_CLIENT_ID!,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${API_URL}/api/auth/apple/callback`,
    }),
  });
  const tokenData = await tokenRes.json() as { id_token?: string; error?: string };
  if (!tokenData.id_token) throw new Error(tokenData.error ?? "Failed to get Apple ID token");

  // Decode ID token payload (Apple's id_token is a JWT)
  const parts = tokenData.id_token.split(".");
  if (parts.length !== 3) throw new Error("Invalid Apple ID token");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

  return {
    sub: payload.sub,
    email: payload.email ?? "",
    name: payload.email?.split("@")[0] ?? "User",
  };
}

/**
 * Find or create user from OAuth data.
 */
export async function findOrCreateUser(
  app: FastifyInstance,
  data: {
    email: string;
    name: string;
    avatar?: string | null;
    authProvider: AuthProvider;
    givenName?: string;
    familyName?: string;
    locale?: string;
    googleId?: string;
    githubId?: string;
    appleId?: string;
    emailVerified?: boolean;
  }
) {
  let user = await app.prisma.user.findUnique({ where: { email: data.email } });

  if (!user) {
    user = await app.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        avatar: data.avatar ?? null,
        givenName: data.givenName ?? null,
        familyName: data.familyName ?? null,
        locale: data.locale ?? null,
        googleId: data.googleId ?? null,
        githubId: data.githubId ?? null,
        appleId: data.appleId ?? null,
        emailVerified: data.emailVerified ?? false,
        authProvider: data.authProvider,
        notificationPreference: {
          create: {
            pushEnabled: true,
            emailEnabled: false,
          },
        },
      },
    });
  } else {
    // Update profile data on each login to keep it fresh
    user = await app.prisma.user.update({
      where: { id: user.id },
      data: {
        name: data.name,
        avatar: data.avatar ?? user.avatar,
        givenName: data.givenName ?? user.givenName,
        familyName: data.familyName ?? user.familyName,
        locale: data.locale ?? user.locale,
        googleId: data.googleId ?? user.googleId,
        githubId: data.githubId ?? user.githubId,
        appleId: data.appleId ?? user.appleId,
        emailVerified: data.emailVerified ?? user.emailVerified,
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
