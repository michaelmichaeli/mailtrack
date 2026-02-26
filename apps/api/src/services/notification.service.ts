import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:mailtrack@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  url?: string;
}

/**
 * Send a push notification to a user's subscribed browser.
 */
export async function sendPushNotification(
  subscriptionJson: string,
  payload: NotificationPayload
): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[push] VAPID keys not configured, skipping notification");
    return false;
  }

  try {
    const subscription = JSON.parse(subscriptionJson);
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
      { TTL: 60 * 60 } // 1 hour expiry
    );
    return true;
  } catch (err: any) {
    // 410 = subscription expired/unsubscribed
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      console.log("[push] Subscription expired, should remove");
      return false;
    }
    console.error("[push] Failed to send notification:", err?.message);
    return false;
  }
}

/**
 * Notify a user about a package status change.
 */
export async function notifyStatusChange(
  prisma: any,
  userId: string,
  trackingNumber: string,
  oldStatus: string,
  newStatus: string,
  packageId: string
): Promise<void> {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  if (!pref?.pushEnabled || !pref?.pushSubscription) return;

  const statusLabels: Record<string, string> = {
    ORDERED: "Ordered",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    IN_TRANSIT: "In Transit",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered 🎉",
    EXCEPTION: "⚠️ Exception",
    RETURNED: "Returned",
  };

  const title = newStatus === "DELIVERED"
    ? "📦 Package Delivered!"
    : "📦 Tracking Update";

  const body = `${trackingNumber}: ${statusLabels[newStatus] ?? newStatus}`;

  await sendPushNotification(pref.pushSubscription, {
    title,
    body,
    tag: `pkg-${packageId}`,
    url: `/orders/${packageId}`,
    icon: "/icon-192.png",
  });
}
