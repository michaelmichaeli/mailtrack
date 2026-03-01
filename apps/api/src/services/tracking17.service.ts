/**
 * 17track.net scraper service using Playwright.
 * 17track aggregates 2000+ carriers and provides rich tracking data.
 * Uses headless browser to intercept their REST API responses (which require signed requests).
 * Playwright is optional — not available in production Docker containers.
 */
import { PackageStatus, Carrier } from "@mailtrack/shared";
import type { CarrierTrackingResult, CarrierTrackingEvent } from "@mailtrack/shared";

let browser: any = null;

async function getBrowser(): Promise<any> {
  const { chromium } = await import("playwright");
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

export async function closeBrowser() {
  if (browser?.isConnected()) {
    await browser.close();
    browser = null;
  }
}

// 17track status → our status
function mapStatus(stage: string | null, subStatus: string | null): PackageStatus {
  const s = (stage || subStatus || "").toLowerCase();
  if (s.includes("delivered")) return PackageStatus.DELIVERED;
  if (s.includes("pickup") || s.includes("availableforpickup")) return PackageStatus.OUT_FOR_DELIVERY;
  if (s.includes("outfordelivery")) return PackageStatus.OUT_FOR_DELIVERY;
  if (s.includes("arrival") || s.includes("intransit")) return PackageStatus.IN_TRANSIT;
  if (s.includes("departure") || s.includes("pickedup")) return PackageStatus.IN_TRANSIT;
  if (s.includes("inforeceived")) return PackageStatus.PROCESSING;
  if (s.includes("returning") || s.includes("returned")) return PackageStatus.RETURNED;
  if (s.includes("exception") || s.includes("expired")) return PackageStatus.EXCEPTION;
  return PackageStatus.IN_TRANSIT;
}

// Extract location from Hebrew/English description
function extractLocationFrom17track(description: string): string | null {
  // Hebrew format: "מרכז מסירה אגית טכנולוגיה (בית עסק), תל אביב - יפו - נמסר ליעדו"
  // Location is typically before the last " - " (which is the status)
  const parts = description.split(" - ");
  if (parts.length >= 2) {
    // Take everything before the last part (which is usually the status description)
    const locationPart = parts.slice(0, -1).join(" - ").trim();
    // Clean up: remove trailing commas
    const cleaned = locationPart.replace(/,\s*$/, "").trim();
    if (cleaned.length > 2 && cleaned.length < 200) return cleaned;
  }
  return null;
}

// Extract status description (the action part, after location)
function extractStatusDesc(description: string): string {
  const parts = description.split(" - ");
  if (parts.length >= 2) {
    return parts[parts.length - 1].trim();
  }
  return description;
}

interface Track17Shipment {
  number: string;
  carrier: number;
  state: string;
  shipment: {
    shipping_info: {
      shipper_address: { country: string };
      recipient_address: { country: string };
    };
    latest_status: { status: string; sub_status: string };
    latest_event: { time_iso: string; description: string; stage: string };
    time_metrics: {
      days_after_order: number;
      days_of_transit: number;
      estimated_delivery_date: { from: string | null; to: string | null };
    };
    milestone: Array<{ key_stage: string; time_iso: string | null }>;
    tracking: {
      providers: Array<{
        provider: { key: number; name: string; country: string };
        events: Array<{
          time_iso: string;
          time_utc: string;
          description: string;
          location: string | null;
          stage: string | null;
          sub_status: string;
        }>;
      }>;
    };
  } | null;
}

/**
 * Fetch tracking data for multiple tracking numbers at once using 17track.
 * Max ~10 numbers per batch (17track URL limitation).
 */
export async function track17Batch(
  trackingNumbers: string[]
): Promise<Map<string, Track17Shipment>> {
  const results = new Map<string, Track17Shipment>();
  if (trackingNumbers.length === 0) return results;

  const b = await getBrowser();
  const ctx = await b.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "en-US",
    viewport: { width: 1440, height: 900 },
  });

  try {
    const page = await ctx.newPage();

    // Block ads, trackers, and unnecessary resources to speed up loading
    await page.route("**/*", (route: any) => {
      const url = route.request().url();
      const type = route.request().resourceType();
      if (
        type === "image" || type === "media" || type === "font" ||
        url.includes("google-analytics") || url.includes("googlesyndication") ||
        url.includes("doubleclick") || url.includes("adnxs") ||
        url.includes("facebook") || url.includes("oneadtag") ||
        url.includes("smaato") || url.includes("aidemsrv") ||
        url.includes("adsense") || url.includes("adservice") ||
        url.includes("tracker") || url.includes("rtb")
      ) {
        return route.abort();
      }
      return route.continue();
    });

    // Intercept REST API responses
    page.on("response", async (response: any) => {
      if (!response.url().includes("track/restapi")) return;
      try {
        const json = await response.json();
        if (json?.shipments) {
          for (const s of json.shipments) {
            if (s.shipment && s.state === "Success") {
              results.set(s.number, s);
            }
          }
        }
      } catch {
        // ignore non-JSON responses
      }
    });

    const nums = trackingNumbers.join(",");
    await page.goto(`https://t.17track.net/en#nums=${nums}`, {
      timeout: 20000,
      waitUntil: "domcontentloaded",
    });

    // Wait for API responses with shorter timeout
    const maxWait = 20000;
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      await page.waitForTimeout(1500);
      const found = trackingNumbers.filter((n) => results.has(n)).length;
      if (found >= trackingNumbers.length) break;
      if (Date.now() - startTime > 12000 && found > 0) break;
    }

    await page.close();
  } catch (error: any) {
    console.error("[17track] Scraping error:", error?.message);
  } finally {
    await ctx.close();
  }

  return results;
}

/**
 * Convert 17track shipment data to our CarrierTrackingResult format
 */
export function convert17TrackResult(
  shipment: Track17Shipment,
  carrier: Carrier
): CarrierTrackingResult {
  const s = shipment.shipment!;
  const allEvents: CarrierTrackingEvent[] = [];

  // Collect events from all providers
  for (const provider of s.tracking?.providers ?? []) {
    for (const event of provider.events ?? []) {
      const description = event.description || "";
      const location =
        event.location ||
        extractLocationFrom17track(description);
      const statusDesc = extractStatusDesc(description);

      allEvents.push({
        timestamp: event.time_iso || event.time_utc,
        location,
        status: mapStatus(event.stage, event.sub_status),
        description: description, // Keep full description including Hebrew
      });
    }
  }

  // Determine overall status
  const latestStatus = mapStatus(
    s.latest_status?.status,
    s.latest_status?.sub_status
  );

  // Last known location
  const lastLocation =
    allEvents.find((e) => e.location)?.location ?? null;

  // Estimated delivery
  const estFrom = s.time_metrics?.estimated_delivery_date?.from;
  const estTo = s.time_metrics?.estimated_delivery_date?.to;
  const estimatedDelivery = estFrom
    ? new Date(estFrom).toISOString()
    : estTo
    ? new Date(estTo).toISOString()
    : null;

  // Extract pickup location from events (Hebrew: "מרכז מסירה" = pickup center)
  let pickupLocation: any = null;
  const pickupEvent = allEvents.find(
    (e) =>
      e.description.includes("מרכז מסירה") ||
      e.description.includes("pickup") ||
      e.description.includes("נמסר") ||
      e.description.includes("הגיע ליחידה")
  );
  if (pickupEvent?.location) {
    pickupLocation = {
      name: pickupEvent.location,
      address: pickupEvent.location,
    };
  }

  return {
    trackingNumber: shipment.number,
    carrier,
    status: latestStatus,
    estimatedDelivery,
    lastLocation,
    events: allEvents,
    pickupLocation,
    originCountry: s.shipping_info?.shipper_address?.country || null,
    destCountry: s.shipping_info?.recipient_address?.country || null,
  };
}

/**
 * Track a single package via 17track
 */
export async function track17Single(
  trackingNumber: string,
  carrier: Carrier
): Promise<CarrierTrackingResult | null> {
  const results = await track17Batch([trackingNumber]);
  const shipment = results.get(trackingNumber);
  if (!shipment?.shipment) return null;
  return convert17TrackResult(shipment, carrier);
}
