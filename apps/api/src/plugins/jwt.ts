import jwt from "@fastify/jwt";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { userId: string };
    user: { userId: string };
  }
}

const jwtPluginImpl: FastifyPluginAsync = async (fastify) => {
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET ?? "dev-jwt-secret",
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
