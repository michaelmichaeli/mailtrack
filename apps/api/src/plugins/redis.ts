import Redis from "ioredis";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPluginImpl: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null, // Required for BullMQ
    lazyConnect: true,
  });

  try {
    await redis.connect();
    fastify.log.info("Redis connected");
  } catch (err) {
    fastify.log.warn("Redis not available, running without cache/queue");
  }

  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    await redis.quit();
  });
};

export const redisPlugin = fp(redisPluginImpl, {
  name: "redis",
});
