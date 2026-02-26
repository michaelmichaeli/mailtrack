import type { CarrierTrackingResult, CarrierTrackingEvent } from "@mailtrack/shared";
import { PackageStatus, Carrier } from "@mailtrack/shared";

const CAINIAO_API = "https://global.cainiao.com/global/detail.json";

// Rate limit: track last fetch time per tracking number
const lastFetchMap = new Map<string, number>();
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes between fetches per tracking number

// Cainiao status → our status
const CAINIAO_STATUS_MAP: Record<string, PackageStatus> = {
  WAIT_ACCEPT: PackageStatus.PROCESSING,
  ACCEPTED: PackageStatus.PROCESSING,
  TRANSITING: PackageStatus.IN_TRANSIT,
  CLEAR_CUSTOMS: PackageStatus.IN_TRANSIT,
  DELIVERING: PackageStatus.OUT_FOR_DELIVERY,
  DELIVERED: PackageStatus.DELIVERED,
  SIGN: PackageStatus.DELIVERED,
  FAILED: PackageStatus.EXCEPTION,
  RETURN: PackageStatus.RETURNED,
};

// Cainiao actionCode → fine-grained status
function actionCodeToStatus(actionCode: string, fallback: PackageStatus): PackageStatus {
  if (!actionCode) return fallback;
  if (actionCode.includes("DELIVERED") || actionCode.includes("SIGN") || actionCode === "GTMS_STA_SIGNED_DELIVER") return PackageStatus.DELIVERED;
  if (actionCode === "GTMS_STA_SIGNED" || actionCode.includes("PICKUP")) return PackageStatus.OUT_FOR_DELIVERY;
  if (actionCode.includes("GTMS_ACCEPT") || actionCode.includes("DELIVERING")) return PackageStatus.OUT_FOR_DELIVERY;
  if (actionCode.includes("CC_IM") || actionCode.includes("CC_EX")) return PackageStatus.IN_TRANSIT;
  if (actionCode.includes("LH_") || actionCode.includes("SC_")) return PackageStatus.IN_TRANSIT;
  if (actionCode.includes("GWMS_")) return PackageStatus.PROCESSING;
  if (actionCode.includes("INFORM_BUYER")) return PackageStatus.OUT_FOR_DELIVERY;
  return fallback;
}

// Extract location from Cainiao event description, e.g. "[IL,תל אביב - יפו,מחוז תל אביב 5339001]"
function extractLocation(desc: string, standerdDesc: string): string | null {
  const combined = `${standerdDesc} ${desc}`;
  const match = combined.match(/\[([^\]]+)\]/);
  if (match) return match[1].replace(/^IL,?\s*/, "").trim() || match[1].trim();
  return null;
}

/**
 * Track a package using Cainiao's public API (no API key required).
 * Works for AliExpress Standard, Cainiao, and most China-origin packages.
 */
export async function trackPackage(
  trackingNumber: string,
  carrier: Carrier
): Promise<CarrierTrackingResult | null> {
  // Rate limiting per tracking number
  const lastFetch = lastFetchMap.get(trackingNumber);
  if (lastFetch && Date.now() - lastFetch < RATE_LIMIT_MS) {
    console.log(`[tracking] Rate limited: ${trackingNumber} (fetched ${Math.round((Date.now() - lastFetch) / 1000)}s ago)`);
    return null;
  }

  try {
    const url = `${CAINIAO_API}?mailNos=${encodeURIComponent(trackingNumber)}&lang=en-US`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[tracking] Cainiao HTTP ${response.status} for ${trackingNumber}`);
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      console.error(`[tracking] Cainiao returned non-JSON for ${trackingNumber} (rate limited?)`);
      return null;
    }

    const data: any = await response.json();
    if (!data?.success || !data?.module?.[0]) {
      console.error(`[tracking] Cainiao: no data for ${trackingNumber}`);
      return null;
    }

    lastFetchMap.set(trackingNumber, Date.now());

    const module = data.module[0];
    const overallStatus = CAINIAO_STATUS_MAP[module.status] ?? PackageStatus.IN_TRANSIT;
    const detailList: any[] = module.detailList ?? [];

    const events: CarrierTrackingEvent[] = detailList
      .filter((e: any) => e.actionCode !== "LAST_MILE_ASN_NOTIFY") // skip forecast noise
      .map((e: any) => {
        const desc = e.standerdDesc || e.desc || "";
        const rawDesc = e.desc || e.standerdDesc || "";
        const location = extractLocation(e.desc ?? "", e.standerdDesc ?? "");
        const eventStatus = actionCodeToStatus(e.actionCode ?? "", overallStatus);

        return {
          timestamp: new Date(e.time).toISOString(),
          location,
          status: eventStatus,
          description: desc,
        };
      });

    // Determine last known location from latest event with a location
    const lastLocation = events.find((e) => e.location)?.location ?? null;

    return {
      trackingNumber,
      carrier,
      status: overallStatus,
      estimatedDelivery: null,
      lastLocation,
      events,
    };
  } catch (error: any) {
    console.error(`[tracking] Error fetching ${trackingNumber}:`, error?.message ?? error);
    return null;
  }
}

