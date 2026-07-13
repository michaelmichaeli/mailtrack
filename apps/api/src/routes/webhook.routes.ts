import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { emailSyncQueue } from "../workers/queues.js";

// ─── Schemas ───

const gmailPushSchema = z.object({
  message: z.object({
    // Pub/Sub guarantees these fields. data is a base64 JSON blob.
    data: z.string().min(1),
    messageId: z.string().optional(),
    publishTime: z.string().optional(),
    attributes: z.record(z.string()).optional(),
  }),
  subscription: z.string().optional(),
});

const gmailPayloadSchema = z.object({
  emailAddress: z.string().email(),
  historyId: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

const outlookNotificationSchema = z.object({
  value: z.array(
    z.object({
      subscriptionId: z.string().optional(),
      clientState: z.string().optional(),
      changeType: z.string().optional(),
      resource: z.string().optional(),
      resourceData: z.unknown().optional(),
      tenantId: z.string().optional(),
    })
  ),
});

// Cache the OIDC verifier — its JWKS is fetched lazily and cached.
let googleOidcClient: OAuth2Client | null = null;
function getGoogleOidcClient(): OAuth2Client {
  if (!googleOidcClient) googleOidcClient = new OAuth2Client();
  return googleOidcClient;
}

/**
 * Verify the Google-signed OIDC token Pub/Sub attaches to push notifications.
 * Returns the verified email if valid, or null if not. In dev (no expected
 * service account configured), returns "dev" so the webhook can still flow.
 */
async function verifyPubSubToken(authHeader: string | undefined): Promise<string | null> {
  const expectedAudience = process.env.PUBSUB_PUSH_AUDIENCE;
  const expectedServiceAccount = process.env.PUBSUB_PUSH_SERVICE_ACCOUNT;

  // If neither is configured, only allow in non-prod.
  if (!expectedAudience && !expectedServiceAccount) {
    return process.env.NODE_ENV === "production" ? null : "dev-no-verification";
  }

  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  try {
    const ticket = await getGoogleOidcClient().verifyIdToken({
      idToken: token,
      audience: expectedAudience,
    });
    const payload = ticket.getPayload();
    if (!payload) return null;
    if (expectedServiceAccount && payload.email !== expectedServiceAccount) return null;
    if (payload.email_verified === false) return null;
    return payload.email ?? "verified";
  } catch {
    return null;
  }
}

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/webhooks/gmail — Gmail Pub/Sub push notification.
   * Authentication: Google-signed OIDC bearer token attached by Pub/Sub.
   *   Configure: PUBSUB_PUSH_AUDIENCE, PUBSUB_PUSH_SERVICE_ACCOUNT.
   */
  app.post("/gmail", async (request, reply) => {
    // 1. Verify Pub/Sub OIDC token.
    const verified = await verifyPubSubToken(request.headers.authorization);
    if (!verified) {
      app.log.warn("[webhooks/gmail] unauthorized push (missing/invalid OIDC token)");
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // 2. Validate envelope.
    const envelope = gmailPushSchema.safeParse(request.body);
    if (!envelope.success) {
      return reply.status(400).send({ error: "Invalid webhook payload" });
    }

    // 3. Decode and validate inner data.
    let decoded: unknown;
    try {
      decoded = JSON.parse(
        Buffer.from(envelope.data.message.data, "base64").toString("utf8")
      );
    } catch {
      return reply.status(400).send({ error: "Invalid base64/json data" });
    }

    const payload = gmailPayloadSchema.safeParse(decoded);
    if (!payload.success) {
      return reply.status(400).send({ error: "Invalid payload schema" });
    }

    const { emailAddress, historyId } = payload.data;
    app.log.info({ emailAddress, historyId }, "[webhooks/gmail] received");

    // 4. Enqueue sync job. Use a job-id to dedupe rapid duplicate pushes.
    try {
      await emailSyncQueue.add(
        "sync-email",
        { provider: "GMAIL", emailAddress, historyId },
        {
          jobId: `gmail:${emailAddress}:${historyId}`,
          removeOnComplete: 1000,
          removeOnFail: 100,
          attempts: 5,
          backoff: { type: "exponential", delay: 5000 },
        }
      );
    } catch (err) {
      app.log.error(err, "[webhooks/gmail] enqueue failed");
      // Returning 500 makes Pub/Sub retry — preferred over silently dropping.
      return reply.status(500).send({ error: "Enqueue failed" });
    }

    return { success: true };
  });

  /**
   * POST /api/webhooks/outlook — Microsoft Graph subscription notification.
   * GET also handled for the validation handshake (validationToken query param).
   * Authentication: clientState comparison (Graph echoes the value the
   *   subscription was created with). Configure GRAPH_CLIENT_STATE.
   */
  const outlookHandler = async (request: any, reply: any) => {
    // Microsoft Graph validation handshake — replies with the token in plain text.
    const validationToken = (request.query as any)?.validationToken;
    if (validationToken) {
      reply.type("text/plain").status(200);
      return validationToken;
    }

    const expectedClientState = process.env.GRAPH_CLIENT_STATE;
    if (!expectedClientState && process.env.NODE_ENV === "production") {
      app.log.error("[webhooks/outlook] GRAPH_CLIENT_STATE not configured");
      return reply.status(500).send({ error: "Server misconfigured" });
    }

    const parsed = outlookNotificationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid webhook payload" });
    }

    // Verify clientState on every notification — reject if any mismatch.
    if (expectedClientState) {
      const allValid = parsed.data.value.every(
        (n) => n.clientState === expectedClientState
      );
      if (!allValid) {
        app.log.warn("[webhooks/outlook] clientState mismatch");
        return reply.status(401).send({ error: "Unauthorized" });
      }
    }

    for (const notification of parsed.data.value) {
      app.log.info(
        { resource: notification.resource, changeType: notification.changeType },
        "[webhooks/outlook] received"
      );
      try {
        await emailSyncQueue.add(
          "sync-email",
          {
            provider: "OUTLOOK",
            resource: notification.resource,
            changeType: notification.changeType,
            subscriptionId: notification.subscriptionId,
          },
          {
            jobId: `outlook:${notification.subscriptionId}:${notification.resource}`,
            removeOnComplete: 1000,
            removeOnFail: 100,
            attempts: 5,
            backoff: { type: "exponential", delay: 5000 },
          }
        );
      } catch (err) {
        app.log.error(err, "[webhooks/outlook] enqueue failed");
        return reply.status(500).send({ error: "Enqueue failed" });
      }
    }

    // Graph requires a 202 within 30s.
    return reply.status(202).send({ success: true });
  };

  app.post("/outlook", outlookHandler);
  app.get("/outlook", outlookHandler);
};
