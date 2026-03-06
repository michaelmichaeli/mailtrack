import type { CarrierTrackingResult, CarrierTrackingEvent } from "@mailtrack/shared";
import { PackageStatus, Carrier } from "@mailtrack/shared";

const CAINIAO_API = "https://global.cainiao.com/global/detail.json";

// Rate limit: track last fetch time per tracking number
const lastFetchMap = new Map<string, number>();
const RATE_LIMIT_MS = 2 * 60 * 1000; // 2 minutes between fetches per tracking number

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
  if (actionCode.startsWith("CC_")) return PackageStatus.IN_TRANSIT;
  if (actionCode.includes("LH_") || actionCode.includes("SC_")) return PackageStatus.IN_TRANSIT;
  if (actionCode.includes("GWMS_")) return PackageStatus.PROCESSING;
  if (actionCode.includes("INFORM_BUYER")) return PackageStatus.OUT_FOR_DELIVERY;
  return fallback;
}

// Extract location from Cainiao event description, e.g. "[תל אביב - יפו]" or "[Shatian Town]"
function extractLocation(desc: string, standerdDesc: string, group?: any): string | null {
  // Look for bracketed locations in standardized description first, then raw desc
  const combined = `${standerdDesc} ${desc}`;
  const match = combined.match(/\[([^\]]+)\]/);
  if (match) {
    let inner = match[1]
      .replace(/^[A-Z]{2},?\s*/, "")   // strip country code (IL, CN, etc.)
      .replace(/\d{5,7}/g, "")        // strip zip codes
      .replace(/,\s*,/g, ",")         // clean up double commas
      .replace(/^[,\s]+|[,\s]+$/g, "") // trim edges
      .trim();
    if (!inner || inner.length < 2) return null;
    return inner;
  }
  // Use group node description as location hint (e.g. country)
  if (group?.nodeDesc && /^[A-Z]/.test(group.nodeDesc) && !["Delivered", "Shipped", "Ordered"].includes(group.nodeDesc)) {
    return null; // Group names are status labels, not locations
  }
  return null;
}

// Clean raw Cainiao description: remove bracketed location prefixes, clean up text
function cleanDescription(desc: string): string {
  return desc
    .replace(/\[[^\]]*\]\s*/g, "")  // remove [IL, city, region] prefixes
    .replace(/^\s*[-–—]\s*/, "")     // remove leading dashes
    .trim() || desc.trim();
}

// Known Israeli cities/regions for location validation (Hebrew + English)
const ISRAELI_LOCATION_PATTERNS = /[\u0590-\u05FF]|israel|tel\s*aviv|jerusalem|haifa|beer\s*sheva|ashdod|ashkelon|netanya|herzliya|ramat\s*gan|petah\s*tikva|rishon|holon|bat\s*yam|rehovot|kfar\s*saba|modi.in|eilat|tiberias|nazareth|acre|akko|nahariya|kiryat|raanana|givatayim|bnei\s*brak/i;

/** Strip non-Israeli locations from tracking results (for Israeli packages tracked via 17track/Cainiao) */
function stripForeignLocations(result: CarrierTrackingResult): CarrierTrackingResult {
  const cleanedEvents = result.events.map((e) => {
    if (e.location && !ISRAELI_LOCATION_PATTERNS.test(e.location)) {
      return { ...e, location: null };
    }
    return e;
  });

  const lastLocation = cleanedEvents.find((e) => e.location)?.location || null;

  return {
    ...result,
    events: cleanedEvents,
    lastLocation,
  };
}

/**
 * Track a package using Cainiao's public API (no API key required).
 * Works for AliExpress Standard, Cainiao, and most China-origin packages.
 */
/** Clear rate limit cache (e.g. before a manual full sync) */
export function clearRateLimits() {
  lastFetchMap.clear();
}

export async function trackPackage(
  trackingNumber: string,
  carrier: Carrier,
  skipRateLimit = false
): Promise<CarrierTrackingResult | null> {
  // Rate limiting per tracking number
  if (!skipRateLimit) {
    const lastFetch = lastFetchMap.get(trackingNumber);
    if (lastFetch && Date.now() - lastFetch < RATE_LIMIT_MS) {
      console.log(`[tracking] Rate limited: ${trackingNumber} (fetched ${Math.round((Date.now() - lastFetch) / 1000)}s ago)`);
      return null;
    }
  }

  // Strategy: Israel Post first for Israeli packages, 17track for others
  const { isIsraelPostPackage, trackIsraelPost } = await import("./israelpost.service.js");

  if (isIsraelPostPackage(trackingNumber, carrier)) {
    // Israeli package → try Israel Post API first (fast, accurate locations)
    try {
      console.log(`[tracking] Trying Israel Post for ${trackingNumber}...`);
      const result = await trackIsraelPost(trackingNumber);
      if (result && result.events.length > 0) {
        console.log(`[tracking] Israel Post: ${result.events.length} events for ${trackingNumber}`);
        lastFetchMap.set(trackingNumber, Date.now());
        return result;
      }
      console.log(`[tracking] Israel Post: no data for ${trackingNumber}, trying 17track...`);
    } catch (error: any) {
      console.error(`[tracking] Israel Post error for ${trackingNumber}:`, error?.message);
    }

    // Fallback to 17track for Israeli packages (but strip bad locations)
    try {
      const { track17Single } = await import("./tracking17.service.js");
      const result17 = await track17Single(trackingNumber, carrier);
      if (result17 && result17.events.length > 0) {
        // Strip non-Israeli location data from 17track results for Israeli packages
        const cleaned = stripForeignLocations(result17);
        console.log(`[tracking] 17track (location-stripped): ${cleaned.events.length} events for ${trackingNumber}`);
        lastFetchMap.set(trackingNumber, Date.now());
        return cleaned;
      }
    } catch (error: any) {
      console.error(`[tracking] 17track error for ${trackingNumber}:`, error?.message);
    }

    return null;
  }

  // Non-Israeli package → 17track first, Cainiao fallback (unchanged)
  try {
    console.log(`[tracking] Trying 17track for ${trackingNumber}...`);
    const { track17Single } = await import("./tracking17.service.js");
    const result17 = await track17Single(trackingNumber, carrier);
    if (result17 && result17.events.length > 0) {
      console.log(`[tracking] 17track: ${result17.events.length} events for ${trackingNumber}`);
      lastFetchMap.set(trackingNumber, Date.now());
      return result17;
    }
    console.log(`[tracking] 17track: no data for ${trackingNumber}, trying Cainiao...`);
  } catch (error: any) {
    console.error(`[tracking] 17track error for ${trackingNumber}:`, error?.message);
  }

  // Fallback to Cainiao direct API
  return trackPackageCainiao(trackingNumber, carrier);
}

/** Track via Cainiao direct API (fallback) */
async function trackPackageCainiao(
  trackingNumber: string,
  carrier: Carrier,
): Promise<CarrierTrackingResult | null> {
  try {
    const url = `${CAINIAO_API}?mailNos=${encodeURIComponent(trackingNumber)}&lang=en-US`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://global.cainiao.com/detail.htm",
      },
      signal: AbortSignal.timeout(15000),
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

    // Detect Cainiao rate-limit / captcha response
    if (data?.ret?.[0] === "FAIL_SYS_USER_VALIDATE") {
      console.error(`[tracking] Cainiao captcha/rate-limit for ${trackingNumber}`);
      return null;
    }

    if (!data?.success || !data?.module?.[0]) {
      console.error(`[tracking] Cainiao: no data for ${trackingNumber}`, data?.ret);
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
          description: cleanDescription(desc),
        };
      });

    // Determine last known location: prefer destination-country locations over transit hubs
    const israelEvent = events.find((e) => e.location && /[\u0590-\u05FF]/.test(e.location));
    const lastLocation = israelEvent?.location ?? events.find((e) => e.location)?.location ?? null;

    // Extract pickup info from Cainiao data
    // Only use pickupInfo/cpInfo if it has a real address (not just carrier name)
    let pickupLocation: any = null;
    if (module.pickupInfo || module.cpInfo) {
      const info = module.pickupInfo || module.cpInfo;
      if (info.address || info.cpAddress) {
        pickupLocation = {
          address: info.address || info.cpAddress || null,
          hours: info.openTime || info.workTime || null,
          pickupCode: info.pickupCode || info.cpCode || null,
          name: info.cpName || info.stationName || null,
        };
      }
    }
    // If no real pickup address, store carrier info only (no address to avoid fabrication)
    if (!pickupLocation && module.destCpInfo?.cpName) {
      const cp = module.destCpInfo;
      pickupLocation = {
        name: cp.cpName || null,
        phone: cp.phone || null,
        url: cp.url || null,
        carrierOnly: true, // flag: this is carrier info, not a specific pickup point
      };
    }

    // Extract estimated delivery from Cainiao
    const estimatedDelivery = module.estimatedDeliveryDate
      ? new Date(module.estimatedDeliveryDate).toISOString()
      : module.latestDeliveryDate
      ? new Date(module.latestDeliveryDate).toISOString()
      : null;

    return {
      trackingNumber,
      carrier,
      status: overallStatus,
      estimatedDelivery,
      lastLocation,
      events,
      pickupLocation,
      originCountry: module.originCountry ?? null,
      destCountry: module.destCountry ?? null,
    };
  } catch (error: any) {
    console.error(`[tracking] Error fetching ${trackingNumber}:`, error?.message ?? error);
    return null;
  }
}

