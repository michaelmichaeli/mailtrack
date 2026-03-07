import { Resend } from "resend";
import type { PrismaClient, PackageStatus } from "@prisma/client";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM ?? "MailTrack <digest@mailtrack.app>";

interface DigestData {
  userName: string;
  email: string;
  totalPackages: number;
  delivered: PackageSummary[];
  inTransit: PackageSummary[];
  exceptions: PackageSummary[];
  newOrders: PackageSummary[];
  weekStart: string;
  weekEnd: string;
}

interface PackageSummary {
  trackingNumber: string;
  carrier: string;
  status: PackageStatus;
  merchant: string;
  lastLocation: string | null;
  items: string | null;
}

/**
 * Send weekly email digest to all users who have emailEnabled = true.
 */
export async function sendWeeklyDigests(prisma: PrismaClient): Promise<{ sent: number; errors: number }> {
  const users = await prisma.user.findMany({
    where: {
      notificationPreference: { emailEnabled: true },
    },
    include: {
      notificationPreference: true,
    },
  });

  if (!users.length) {
    console.log("[email-digest] No users opted in for email digest");
    return { sent: 0, errors: 0 };
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let sent = 0;
  let errors = 0;

  for (const user of users) {
    try {
      const packages = await prisma.package.findMany({
        where: {
          order: { userId: user.id },
          updatedAt: { gte: weekAgo },
        },
        include: {
          order: { select: { merchant: true } },
        },
        orderBy: { updatedAt: "desc" },
      });

      // Skip if no package activity this week
      if (!packages.length) continue;

      const toSummary = (p: typeof packages[number]): PackageSummary => ({
        trackingNumber: p.trackingNumber,
        carrier: p.carrier,
        status: p.status,
        merchant: p.order.merchant,
        lastLocation: p.lastLocation,
        items: p.items,
      });

      const digest: DigestData = {
        userName: user.givenName ?? user.name,
        email: user.email,
        totalPackages: packages.length,
        delivered: packages.filter((p) => p.status === "DELIVERED").map(toSummary),
        inTransit: packages
          .filter((p) => ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(p.status))
          .map(toSummary),
        exceptions: packages.filter((p) => ["EXCEPTION", "RETURNED"].includes(p.status)).map(toSummary),
        newOrders: packages
          .filter((p) => ["ORDERED", "PROCESSING"].includes(p.status))
          .map(toSummary),
        weekStart: weekAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        weekEnd: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      };

      await sendDigestEmail(digest);
      sent++;
    } catch (err) {
      console.error(`[email-digest] Failed for user ${user.id}:`, err);
      errors++;
    }
  }

  console.log(`[email-digest] Sent ${sent} digests, ${errors} errors`);
  return { sent, errors };
}

async function sendDigestEmail(data: DigestData): Promise<void> {
  const html = buildDigestHtml(data);

  await resend.emails.send({
    from: FROM_EMAIL,
    to: data.email,
    subject: `📦 Your Weekly Package Summary (${data.weekStart} – ${data.weekEnd})`,
    html,
  });
}

/**
 * Send digest for a single user (used by test endpoint).
 */
export async function sendWeeklyDigestForUser(
  prisma: PrismaClient,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, message: "User not found" };

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const packages = await prisma.package.findMany({
    where: {
      order: { userId },
      updatedAt: { gte: weekAgo },
    },
    include: { order: { select: { merchant: true } } },
    orderBy: { updatedAt: "desc" },
  });

  if (!packages.length) {
    return { success: true, message: "No package activity this week — no email sent" };
  }

  const toSummary = (p: typeof packages[number]): PackageSummary => ({
    trackingNumber: p.trackingNumber,
    carrier: p.carrier,
    status: p.status,
    merchant: p.order.merchant,
    lastLocation: p.lastLocation,
    items: p.items,
  });

  const digest: DigestData = {
    userName: user.givenName ?? user.name,
    email: user.email,
    totalPackages: packages.length,
    delivered: packages.filter((p) => p.status === "DELIVERED").map(toSummary),
    inTransit: packages.filter((p) => ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(p.status)).map(toSummary),
    exceptions: packages.filter((p) => ["EXCEPTION", "RETURNED"].includes(p.status)).map(toSummary),
    newOrders: packages.filter((p) => ["ORDERED", "PROCESSING"].includes(p.status)).map(toSummary),
    weekStart: weekAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    weekEnd: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  };

  await sendDigestEmail(digest);
  return { success: true, message: `Digest sent to ${user.email}` };
}

// ─── HTML Email Template ───

function statusBadge(status: PackageStatus): string {
  const colors: Record<string, { bg: string; text: string }> = {
    DELIVERED: { bg: "#dcfce7", text: "#166534" },
    IN_TRANSIT: { bg: "#dbeafe", text: "#1e40af" },
    SHIPPED: { bg: "#e0e7ff", text: "#3730a3" },
    OUT_FOR_DELIVERY: { bg: "#fef3c7", text: "#92400e" },
    ORDERED: { bg: "#f3f4f6", text: "#374151" },
    PROCESSING: { bg: "#fae8ff", text: "#86198f" },
    EXCEPTION: { bg: "#fee2e2", text: "#991b1b" },
    RETURNED: { bg: "#fef2f2", text: "#7f1d1d" },
  };
  const c = colors[status] ?? { bg: "#f3f4f6", text: "#374151" };
  const label = status.replace(/_/g, " ");
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${c.bg};color:${c.text}">${label}</span>`;
}

function packageRow(p: PackageSummary): string {
  const items = p.items ? parseItems(p.items) : "";
  return `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6">
        <div style="font-weight:600;color:#111827;font-size:14px">${p.merchant}</div>
        ${items ? `<div style="color:#6b7280;font-size:12px;margin-top:2px">${items}</div>` : ""}
        <div style="color:#9ca3af;font-size:11px;margin-top:2px">${p.carrier} · ${p.trackingNumber}</div>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;text-align:right;vertical-align:top">
        ${statusBadge(p.status)}
        ${p.lastLocation ? `<div style="color:#9ca3af;font-size:11px;margin-top:4px">${p.lastLocation}</div>` : ""}
      </td>
    </tr>`;
}

function parseItems(json: string): string {
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr)) return arr.slice(0, 2).join(", ") + (arr.length > 2 ? ` +${arr.length - 2} more` : "");
    return String(arr);
  } catch {
    return json.length > 60 ? json.slice(0, 57) + "..." : json;
  }
}

function packageSection(title: string, emoji: string, packages: PackageSummary[]): string {
  if (!packages.length) return "";
  return `
    <div style="margin-bottom:24px">
      <h2 style="font-size:16px;font-weight:600;color:#111827;margin:0 0 12px 0">${emoji} ${title} (${packages.length})</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #e5e7eb">
        ${packages.map(packageRow).join("")}
      </table>
    </div>`;
}

function buildDigestHtml(data: DigestData): string {
  const appUrl = process.env.WEB_URL ?? "https://mailtrack-omega.vercel.app";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5,#6366f1);border-radius:12px;padding:32px 24px;margin-bottom:24px;text-align:center">
      <div style="font-size:28px;margin-bottom:8px">📦</div>
      <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0">Weekly Delivery Digest</h1>
      <p style="color:#c7d2fe;font-size:14px;margin:8px 0 0">${data.weekStart} – ${data.weekEnd}</p>
    </div>

    <!-- Greeting -->
    <p style="color:#374151;font-size:15px;margin:0 0 24px">
      Hi ${data.userName} 👋 Here's your weekly package activity — <strong>${data.totalPackages} package${data.totalPackages !== 1 ? "s" : ""}</strong> updated this week.
    </p>

    <!-- Stats Bar -->
    <div style="display:flex;gap:12px;margin-bottom:24px">
      ${statCard("✅", "Delivered", data.delivered.length, "#dcfce7", "#166534")}
      ${statCard("🚚", "In Transit", data.inTransit.length, "#dbeafe", "#1e40af")}
      ${statCard("⚠️", "Attention", data.exceptions.length, "#fee2e2", "#991b1b")}
      ${statCard("🆕", "New", data.newOrders.length, "#f3f4f6", "#374151")}
    </div>

    <!-- Package Sections -->
    ${packageSection("Delivered", "✅", data.delivered)}
    ${packageSection("In Transit", "🚚", data.inTransit)}
    ${packageSection("Needs Attention", "⚠️", data.exceptions)}
    ${packageSection("New Orders", "🆕", data.newOrders)}

    <!-- CTA -->
    <div style="text-align:center;margin:32px 0">
      <a href="${appUrl}/packages" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px">View All Packages</a>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #e5e7eb;padding-top:16px;text-align:center">
      <p style="color:#9ca3af;font-size:12px;margin:0">
        You're receiving this because you enabled email digests in <a href="${appUrl}/settings" style="color:#6366f1">settings</a>.
      </p>
      <p style="color:#9ca3af;font-size:11px;margin:8px 0 0">MailTrack — Universal Package Tracking</p>
    </div>
  </div>
</body>
</html>`;
}

function statCard(emoji: string, label: string, count: number, bg: string, color: string): string {
  return `<div style="flex:1;background:${bg};border-radius:8px;padding:12px;text-align:center">
    <div style="font-size:18px">${emoji}</div>
    <div style="font-size:20px;font-weight:700;color:${color}">${count}</div>
    <div style="font-size:11px;color:${color};opacity:0.8">${label}</div>
  </div>`;
}
