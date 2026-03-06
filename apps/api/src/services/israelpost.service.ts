/**
 * Israel Post direct tracking service.
 * Uses doar.israelpost.co.il with Playwright to bypass bot protection.
 * Intercepts XHR/fetch responses to get tracking data as JSON.
 * Provides accurate Israeli location data — the authoritative source for Israel Post packages.
 */
import type { CarrierTrackingResult, CarrierTrackingEvent } from "@mailtrack/shared";
import { PackageStatus, Carrier } from "@mailtrack/shared";

const TRACKING_URL = "https://doar.israelpost.co.il/he/deliverytracking";

// Israel Post status keywords → PackageStatus
const STATUS_MAP: Array<[RegExp, PackageStatus]> = [
  [/נמסר|delivered|picked\s*up/i, PackageStatus.DELIVERED],
  [/מוכן לאיסוף|ready for pickup|available for collection|ממתין לאיסוף/i, PackageStatus.OUT_FOR_DELIVERY],
  [/יצא לחלוקה|out for delivery/i, PackageStatus.OUT_FOR_DELIVERY],
  [/הגיע|arrived|arrival|נקלט|received at/i, PackageStatus.IN_TRANSIT],
  [/יצא|departed|left|נשלח|dispatched|shipped/i, PackageStatus.IN_TRANSIT],
  [/מכס|customs/i, PackageStatus.IN_TRANSIT],
  [/התקבל|accepted|posted/i, PackageStatus.PROCESSING],
  [/הוחזר|returned|return/i, PackageStatus.RETURNED],
  [/חריג|exception|failed|נכשל/i, PackageStatus.EXCEPTION],
];

function mapIsraelPostStatus(description: string): PackageStatus {
  for (const [pattern, status] of STATUS_MAP) {
    if (pattern.test(description)) return status;
  }
  return PackageStatus.IN_TRANSIT;
}

// Pickup center detection from Hebrew descriptions
function extractPickupFromDescription(description: string): string | null {
  const patterns = [
    /מרכז מסירה\s+(.*?)(?:\s*[-–]\s*|$)/i,
    /נקודת חלוקה\s+(.*?)(?:\s*[-–]\s*|$)/i,
    /סניף דואר\s+(.*?)(?:\s*[-–]\s*|$)/i,
  ];
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

// Extract location from event description — Hebrew format: "location - status"
function extractLocationFromDesc(description: string): string | null {
  if (!description) return null;
  const parts = description.split(/\s*[-–]\s*/);
  if (parts.length >= 2) {
    const candidate = parts[0].trim();
    if (/[\u0590-\u05FF]/.test(candidate) && candidate.length > 2 && candidate.length < 60) {
      if (!/נמסר|הוחזר|התקבל|יצא|הגיע|נשלח|מוכן|פריט/i.test(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

/** Parse tracking data from Israel Post page content (scraped via Playwright) */
function parseIsraelPostData(data: any, trackingNumber: string): CarrierTrackingResult | null {
  // Handle various response shapes from Israel Post
  const rawEvents: any[] =
    data?.itemcodealiaslist?.[0]?.EventsList ||
    data?.ItemTracePresentationOL?.itemcodealiaslist?.[0]?.EventsList ||
    data?.events ||
    data?.EventsList ||
    data?.result?.events ||
    [];

  if (rawEvents.length === 0) {
    console.log(`[israelpost] No events found in response for ${trackingNumber}`);
    return null;
  }

  let pickupName: string | null = null;
  let pickupCode: string | null = null;

  const events: CarrierTrackingEvent[] = rawEvents.map((e: any) => {
    const desc = e.EventDescription || e.eventDescription || e.Description || e.description || e.spiDescription || "";
    const date = e.EventDate || e.eventDate || e.Date || e.date || e.eventDate || "";
    const time = e.EventTime || e.eventTime || e.Time || e.time || "";
    const location = e.EventLocation || e.eventLocation || e.location || extractLocationFromDesc(desc);
    const status = mapIsraelPostStatus(desc);

    const pickup = extractPickupFromDescription(desc);
    if (pickup) pickupName = pickup;
    const codeMatch = desc.match(/קוד(?:\s+איסוף)?[:\s]*(\d+)/i);
    if (codeMatch) pickupCode = codeMatch[1];

    let timestamp: string;
    try {
      if (date && time) timestamp = new Date(`${date} ${time}`).toISOString();
      else if (date) timestamp = new Date(date).toISOString();
      else timestamp = new Date().toISOString();
    } catch {
      timestamp = new Date().toISOString();
    }

    return {
      timestamp,
      location: typeof location === "string" && location.trim().length > 1 ? location.trim() : null,
      status,
      description: desc.trim(),
    };
  });

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const overallStatus = events[0]?.status || PackageStatus.IN_TRANSIT;
  const lastLocation = events.find((e) => e.location)?.location || null;

  let pickupLocation: CarrierTrackingResult["pickupLocation"] = null;
  if (pickupName || pickupCode) {
    pickupLocation = { name: pickupName, address: null, hours: null, pickupCode };
  }

  console.log(`[israelpost] ${trackingNumber}: ${events.length} events, status=${overallStatus}, location=${lastLocation}`);

  return {
    trackingNumber,
    carrier: Carrier.ISRAEL_POST,
    status: overallStatus,
    estimatedDelivery: null,
    lastLocation,
    events,
    pickupLocation,
    originCountry: "IL",
    destCountry: "IL",
  };
}

/** Track a single package via Israel Post website using Playwright */
export async function trackIsraelPost(
  trackingNumber: string
): Promise<CarrierTrackingResult | null> {
  let browser: any = null;
  let context: any = null;

  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      locale: "he-IL",
    });

    const page = await context.newPage();
    let capturedData: any = null;

    // Block unnecessary resources to speed up
    await page.route("**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}", (route: any) => route.abort());
    await page.route("**/analytics*", (route: any) => route.abort());
    await page.route("**/gtag*", (route: any) => route.abort());
    await page.route("**/google-analytics*", (route: any) => route.abort());

    // Intercept API responses that contain tracking data
    page.on("response", async (response: any) => {
      const url = response.url();
      if (
        (url.includes("ItemTrace") || url.includes("itemtrace") || url.includes("deliverytracking") || url.includes("tracking")) &&
        response.status() === 200 &&
        !url.endsWith(".js") &&
        !url.endsWith(".css")
      ) {
        try {
          const contentType = response.headers()["content-type"] || "";
          if (contentType.includes("json") || contentType.includes("text")) {
            const body = await response.text();
            if (body.includes("EventsList") || body.includes("events") || body.includes(trackingNumber)) {
              try {
                capturedData = JSON.parse(body);
                console.log(`[israelpost] Captured API response from ${url}`);
              } catch {}
            }
          }
        } catch {}
      }
    });

    // Navigate to tracking page with the item code
    const url = `${TRACKING_URL}?itemcode=${encodeURIComponent(trackingNumber)}`;
    console.log(`[israelpost] Loading ${url}...`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });

    // If no API response was intercepted, try to get data from page content
    if (!capturedData) {
      // Wait for tracking results to appear on page
      try {
        await page.waitForSelector('[class*="tracking"], [class*="event"], [class*="timeline"], [data-testid*="track"]', { timeout: 10000 });
      } catch {
        // Try clicking search/submit if there's a form
        try {
          const searchBtn = await page.$('button[type="submit"], button:has-text("חפש"), button:has-text("Search")');
          if (searchBtn) {
            await searchBtn.click();
            await page.waitForTimeout(3000);
          }
        } catch {}
      }

      // Try to extract data from the DOM
      capturedData = await page.evaluate(() => {
        const events: any[] = [];
        const eventElements = (globalThis as any).document.querySelectorAll('[class*="event"], [class*="tracking-item"], [class*="timeline-item"], tr[class*="track"]');
        
        eventElements.forEach((el: any) => {
          const text = el.textContent || "";
          const dateMatch = text.match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/);
          const timeMatch = text.match(/(\d{1,2}:\d{2})/);
          
          if (dateMatch) {
            events.push({
              eventDate: dateMatch[1],
              eventTime: timeMatch?.[1] || "",
              description: text.trim().substring(0, 200),
            });
          }
        });

        return events.length > 0 ? { events } : null;
      });
    }

    if (!capturedData) {
      console.log(`[israelpost] No tracking data found for ${trackingNumber}`);
      return null;
    }

    return parseIsraelPostData(capturedData, trackingNumber);
  } catch (error: any) {
    console.error(`[israelpost] Error tracking ${trackingNumber}:`, error?.message);
    return null;
  } finally {
    if (context) try { await context.close(); } catch {}
    if (browser) try { await browser.close(); } catch {}
  }
}

/** Track multiple packages via Israel Post (sequential with shared browser) */
export async function trackIsraelPostBatch(
  trackingNumbers: string[],
  concurrency = 3
): Promise<Map<string, CarrierTrackingResult>> {
  const results = new Map<string, CarrierTrackingResult>();
  if (trackingNumbers.length === 0) return results;

  // Process in chunks with concurrency limit
  const chunks: string[][] = [];
  for (let i = 0; i < trackingNumbers.length; i += concurrency) {
    chunks.push(trackingNumbers.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const settled = await Promise.allSettled(
      chunk.map((tn) => trackIsraelPost(tn))
    );

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      if (result.status === "fulfilled" && result.value) {
        results.set(chunk[i], result.value);
      }
    }

    // Delay between chunks
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`[israelpost] Batch complete: ${results.size}/${trackingNumbers.length} tracked`);
  return results;
}

/** Check if a tracking number should use Israel Post */
export function isIsraelPostPackage(trackingNumber: string, carrier?: string): boolean {
  if (carrier === Carrier.ISRAEL_POST || carrier === "ISRAEL_POST") return true;
  if (/^[A-Z]{2}\d{9}IL$/i.test(trackingNumber)) return true;
  return false;
}
