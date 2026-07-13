import jwt from "@fastify/jwt";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { userId: string };
    user: { userId: string };
  }
}

/**
 * Resolve the JWT secret. Fails fast in production if missing or set to a
 * known dev placeholder — a misconfigured prod must never boot with a
 * publicly-known signing key.
 */
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === "production";
  const isPlaceholder =
    !secret ||
    secret === "dev-jwt-secret" ||
    secret === "change-me" ||
    secret.length < 32;

  if (isProd && isPlaceholder) {
    throw new Error(
      "JWT_SECRET must be set to a strong (>=32 char) value in production. " +
        "Generate one with: openssl rand -hex 64"
    );
  }
  return secret ?? "dev-jwt-secret-do-not-use-in-prod-xxxxxxxxxxxx";
}

const jwtPluginImpl: FastifyPluginAsync = async (fastify) => {
  await fastify.register(jwt, {
    secret: resolveJwtSecret(),
    sign: {
      expiresIn: "15m",
      iss: "mailtrack",
    },
    verify: {
      allowedIss: "mailtrack",
    },
  });

  // Decorate with auth helper
  fastify.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: "Unauthorized", message: "Invalid or expired token" });
      }
    }
  );
};

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const jwtPlugin = fp(jwtPluginImpl, {
  name: "jwt-auth",
});
