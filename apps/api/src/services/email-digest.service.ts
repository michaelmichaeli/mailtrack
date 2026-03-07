import { Resend } from "resend";
import type { PrismaClient, PackageStatus } from "@prisma/client";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM ?? "MailTrack <onboarding@resend.dev>";

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
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    DELIVERED: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
    IN_TRANSIT: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
    SHIPPED: { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
    OUT_FOR_DELIVERY: { bg: "#fffbeb", text: "#b45309", border: "#fde68a" },
    ORDERED: { bg: "#f9fafb", text: "#4b5563", border: "#e5e7eb" },
    PROCESSING: { bg: "#fdf4ff", text: "#a21caf", border: "#f0abfc" },
    EXCEPTION: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
    RETURNED: { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
  };
  const c = colors[status] ?? { bg: "#f9fafb", text: "#4b5563", border: "#e5e7eb" };
  const label = status.replace(/_/g, " ");
  return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;background:${c.bg};color:${c.text};border:1px solid ${c.border}">${label}</span>`;
}

function statusIcon(status: PackageStatus): string {
  const icons: Record<string, string> = {
    DELIVERED: "✅",
    IN_TRANSIT: "🚚",
    SHIPPED: "📦",
    OUT_FOR_DELIVERY: "🏃",
    ORDERED: "🛒",
    PROCESSING: "⚙️",
    EXCEPTION: "⚠️",
    RETURNED: "↩️",
  };
  return icons[status] ?? "📦";
}

function packageCard(p: PackageSummary): string {
  const items = p.items ? parseItems(p.items) : "";
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px">
      <tr>
        <td style="background:#ffffff;border-radius:12px;border:1px solid #e8e8ef;padding:0;overflow:hidden">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="4" style="background:${getStatusAccent(p.status)};border-radius:12px 0 0 12px"></td>
              <td style="padding:18px 22px">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td>
                      <span style="font-size:18px;vertical-align:middle">${statusIcon(p.status)}</span>
                      <span style="font-weight:700;color:#1a1a2e;font-size:15px;vertical-align:middle;padding-left:8px">${p.merchant}</span>
                    </td>
                    <td align="right" style="vertical-align:top">
                      ${statusBadge(p.status)}
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding-top:10px">
                      ${items ? `<div style="color:#64748b;font-size:13px;margin-bottom:6px">${items}</div>` : ""}
                      <div style="color:#94a3b8;font-size:12px">${p.carrier} &middot; <span style="font-family:monospace;letter-spacing:0.5px">${p.trackingNumber}</span></div>
                      ${p.lastLocation ? `<div style="color:#94a3b8;font-size:12px;margin-top:4px">📍 ${p.lastLocation}</div>` : ""}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function getStatusAccent(status: PackageStatus): string {
  const accents: Record<string, string> = {
    DELIVERED: "#22c55e",
    IN_TRANSIT: "#3b82f6",
    SHIPPED: "#6366f1",
    OUT_FOR_DELIVERY: "#f59e0b",
    ORDERED: "#94a3b8",
    PROCESSING: "#a855f7",
    EXCEPTION: "#ef4444",
    RETURNED: "#f87171",
  };
  return accents[status] ?? "#94a3b8";
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

function packageSection(title: string, packages: PackageSummary[]): string {
  if (!packages.length) return "";
  const MAX_SHOWN = 5;
  const shown = packages.slice(0, MAX_SHOWN);
  const remaining = packages.length - shown.length;
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px">
      <tr>
        <td style="padding-bottom:12px">
          <span style="font-size:15px;font-weight:700;color:#1e293b;letter-spacing:-0.3px">${title}</span>
          <span style="display:inline-block;background:#e2e8f0;color:#475569;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:8px;vertical-align:middle">${packages.length}</span>
        </td>
      </tr>
      <tr>
        <td>
          ${shown.map(packageCard).join("")}
          ${remaining > 0 ? `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:12px 0;color:#64748b;font-size:13px;font-weight:500">+ ${remaining} more — <a href="${process.env.WEB_URL ?? "https://mailtrack-omega.vercel.app"}/packages" style="color:#6366f1;text-decoration:underline">view all</a></td></tr></table>` : ""}
        </td>
      </tr>
    </table>`;
}

function buildDigestHtml(data: DigestData): string {
  const appUrl = process.env.WEB_URL ?? "https://mailtrack-omega.vercel.app";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Weekly Package Digest</title>
  <!--[if mso]><style>table,td{font-family:Arial,sans-serif}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale">
  <!-- Preheader text -->
  <div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
    ${data.totalPackages} package${data.totalPackages !== 1 ? "s" : ""} updated this week — ${data.delivered.length} delivered, ${data.inTransit.length} in transit
  </div>

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9">
    <tr>
      <td align="center" style="padding:40px 16px">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">

          <!-- Logo bar -->
          <tr>
            <td align="center" style="padding-bottom:28px">
              <a href="${appUrl}" style="text-decoration:none;display:inline-block">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background:#4f46e5;width:32px;height:32px;border-radius:8px;text-align:center;vertical-align:middle;font-size:16px;line-height:32px">📦</td>
                    <td style="padding-left:10px;font-size:19px;font-weight:800;color:#1e293b;letter-spacing:-0.5px;vertical-align:middle">MailTrack</td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>

          <!-- Hero Card -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#6366f1 100%);border-radius:16px 16px 0 0;padding:44px 36px 40px;text-align:center">
              <h1 style="color:#ffffff;font-size:28px;font-weight:800;margin:0 0 10px;letter-spacing:-0.5px">Weekly Digest</h1>
              <p style="color:rgba(255,255,255,0.7);font-size:15px;margin:0;font-weight:500">${data.weekStart} – ${data.weekEnd}</p>
            </td>
          </tr>

          <!-- Stats Row -->
          <tr>
            <td style="background:#ffffff;padding:0 32px;border-left:1px solid #e8e8ef;border-right:1px solid #e8e8ef">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:-22px">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);border:1px solid #e8e8ef;overflow:hidden">
                      <tr>
                        <td width="25%" align="center" style="padding:22px 14px;border-right:1px solid #f0f0f5">
                          <div style="font-size:26px;font-weight:800;color:#16a34a;line-height:1">${data.delivered.length}</div>
                          <div style="font-size:10px;color:#64748b;margin-top:6px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px">Delivered</div>
                        </td>
                        <td width="25%" align="center" style="padding:22px 14px;border-right:1px solid #f0f0f5">
                          <div style="font-size:26px;font-weight:800;color:#2563eb;line-height:1">${data.inTransit.length}</div>
                          <div style="font-size:10px;color:#64748b;margin-top:6px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px">In Transit</div>
                        </td>
                        <td width="25%" align="center" style="padding:22px 14px;border-right:1px solid #f0f0f5">
                          <div style="font-size:26px;font-weight:800;color:#dc2626;line-height:1">${data.exceptions.length}</div>
                          <div style="font-size:10px;color:#64748b;margin-top:6px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px">Attention</div>
                        </td>
                        <td width="25%" align="center" style="padding:22px 14px">
                          <div style="font-size:26px;font-weight:800;color:#7c3aed;line-height:1">${data.newOrders.length}</div>
                          <div style="font-size:10px;color:#64748b;margin-top:6px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px">New</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background:#ffffff;padding:32px 32px 12px;border-left:1px solid #e8e8ef;border-right:1px solid #e8e8ef">
              <!-- Greeting -->
              <p style="color:#334155;font-size:16px;margin:0 0 32px;line-height:1.6">
                Hi <strong>${data.userName}</strong> 👋<br>
                Here's what happened with your <strong>${data.totalPackages} package${data.totalPackages !== 1 ? "s" : ""}</strong> this week.
              </p>

              <!-- Package Sections -->
              ${packageSection("Delivered", data.delivered)}
              ${packageSection("In Transit", data.inTransit)}
              ${packageSection("Needs Attention", data.exceptions)}
              ${packageSection("New Orders", data.newOrders)}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background:#ffffff;padding:12px 32px 40px;text-align:center;border-left:1px solid #e8e8ef;border-right:1px solid #e8e8ef">
              <table cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:10px;padding:14px 40px">
                    <a href="${appUrl}/packages" style="color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.3px;display:inline-block">View All Packages →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:28px 36px;border-radius:0 0 16px 16px;border:1px solid #e8e8ef;border-top:none;text-align:center">
              <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;line-height:1.5">
                You're receiving this because you enabled email digests.
              </p>
              <p style="margin:0">
                <a href="${appUrl}/settings" style="color:#6366f1;font-size:12px;text-decoration:underline">Manage preferences</a>
              </p>
              <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:20px">
                <tr>
                  <td style="background:#e2e8f0;width:24px;height:24px;border-radius:6px;text-align:center;vertical-align:middle;font-size:12px;line-height:24px">📦</td>
                  <td style="padding-left:8px;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:0.8px;vertical-align:middle">MAILTRACK</td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
