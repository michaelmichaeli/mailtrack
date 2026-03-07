import "dotenv/config";
import { buildApp } from "./app.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

// Prevent unhandled rejections from crashing the server
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

async function start() {
  const app = await buildApp();

  // Graceful shutdown on SIGTERM/SIGINT
  const shutdown = async (signal: string) => {
    app.log.info(`[${signal}] Shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`MailTrack API running at http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
