import type { FastifyPluginAsync } from "fastify";

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/webhooks/gmail — Gmail Pub/Sub push notification
  app.post("/gmail", async (request, reply) => {
    try {
      const { message } = request.body as any;
      if (!message?.data) {
        return reply.status(400).send({ error: "Invalid webhook payload" });
      }

      const data = JSON.parse(Buffer.from(message.data, "base64").toString());
      const { emailAddress, historyId } = data;

      app.log.info(`Gmail webhook: ${emailAddress}, historyId: ${historyId}`);

      // In production, queue a job to sync this user's email
      // await emailSyncQueue.add('sync-email', { emailAddress, historyId });

      return { success: true };
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: "Webhook processing failed" });
    }
  });

  // POST /api/webhooks/outlook — Microsoft Graph subscription notification
  app.post("/outlook", async (request, reply) => {
    // Microsoft Graph sends a validation token on subscription creation
    const validationToken = (request.query as any)?.validationToken;
    if (validationToken) {
      reply.type("text/plain");
      return validationToken;
    }

    try {
      const { value } = request.body as any;
      if (!Array.isArray(value)) {
        return reply.status(400).send({ error: "Invalid webhook payload" });
      }

      for (const notification of value) {
        app.log.info(`Outlook webhook: ${notification.resource}`);
        // Queue email sync job
      }

      return { success: true };
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: "Webhook processing failed" });
    }
  });
};
