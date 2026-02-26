import { Queue, Worker, type Job } from "bullmq";
import Redis from "ioredis";
import { POLL_INTERVALS } from "@mailtrack/shared";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// ─── Queue Definitions ───

export const emailSyncQueue = new Queue("sync-email", { connection });
export const trackPackageQueue = new Queue("track-package", { connection });
export const enrichOrderQueue = new Queue("enrich-order", { connection });
export const sendNotificationQueue = new Queue("send-notification", { connection });

// ─── Email Sync Worker ───

export const emailSyncWorker = new Worker(
  "sync-email",
  async (job: Job) => {
    const { userId, emailId } = job.data;
    job.log(`Syncing emails for user ${userId}`);

    // In production, this would:
    // 1. Fetch connected emails for the user
    // 2. Use Gmail/Outlook service to fetch new emails
    // 3. Parse emails using email-parser service
    // 4. Create/update orders and packages
    // 5. Queue track-package jobs for new tracking numbers

    return { success: true, emailsParsed: 0 };
  },
  {
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 60000 }, // Max 10 jobs per minute
  }
);

// ─── Track Package Worker ───

export const trackPackageWorker = new Worker(
  "track-package",
  async (job: Job) => {
    const { packageId, trackingNumber, carrier, currentStatus } = job.data;
    job.log(`Tracking package ${trackingNumber} (${carrier})`);

    // In production, this would:
    // 1. Call tracking service to get latest status
    // 2. Update package in database
    // 3. Create new tracking events
    // 4. Queue notification if status changed
    // 5. Schedule next poll based on current status

    return { success: true };
  },
  {
    connection,
    concurrency: 10,
    limiter: { max: 30, duration: 60000 },
  }
);

// ─── Enrich Order Worker ───

export const enrichOrderWorker = new Worker(
  "enrich-order",
  async (job: Job) => {
    const { orderId, platform } = job.data;
    job.log(`Enriching order ${orderId} from ${platform}`);

    // In production, this would:
    // 1. Check if user has connected shop for this platform
    // 2. Use shop adapter to fetch additional order details
    // 3. Update order with enriched data

    return { success: true };
  },
  {
    connection,
    concurrency: 3,
  }
);

// ─── Send Notification Worker ───

export const sendNotificationWorker = new Worker(
  "send-notification",
  async (job: Job) => {
    const { userId, packageId, trigger, message } = job.data;
    job.log(`Sending notification to user ${userId}: ${trigger}`);

    // In production, this would:
    // 1. Check user's notification preferences
    // 2. Check quiet hours
    // 3. Send push notification via FCM/APNs
    // 4. Optionally send email notification

    return { success: true };
  },
  {
    connection,
    concurrency: 20,
  }
);

// ─── Scheduled Jobs ───

/**
 * Schedule recurring email sync for all users (every 15 minutes).
 */
export async function scheduleEmailSync() {
  await emailSyncQueue.add(
    "scheduled-sync",
    { type: "scheduled" },
    {
      repeat: { every: 15 * 60 * 1000 }, // every 15 minutes
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );
}

/**
 * Get appropriate poll interval based on package status.
 */
export function getPollInterval(status: string): number {
  switch (status) {
    case "OUT_FOR_DELIVERY":
      return POLL_INTERVALS.OUT_FOR_DELIVERY;
    case "IN_TRANSIT":
    case "SHIPPED":
      return POLL_INTERVALS.IN_TRANSIT;
    default:
      return POLL_INTERVALS.PRE_SHIPMENT;
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  await emailSyncWorker.close();
  await trackPackageWorker.close();
  await enrichOrderWorker.close();
  await sendNotificationWorker.close();
  await connection.quit();
});
