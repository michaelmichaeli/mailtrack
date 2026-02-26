import * as cheerio from "cheerio";
import { extractTrackingNumbers, extractTrackingFromSubject, detectCarrier } from "../lib/carrier-detect.js";
import type { ParsedEmail } from "@mailtrack/shared";
import { ShopPlatform, Carrier, PackageStatus } from "@mailtrack/shared";

// Merchant detection patterns
const MERCHANT_PATTERNS: Array<{ pattern: RegExp; platform: ShopPlatform; name: string }> = [
  { pattern: /amazon\.(com|co\.uk|de|fr|it|es|ca|com\.au|co\.jp)/i, platform: ShopPlatform.AMAZON, name: "Amazon" },
  { pattern: /aliexpress\.com/i, platform: ShopPlatform.ALIEXPRESS, name: "AliExpress" },
  { pattern: /cainiao\.com/i, platform: ShopPlatform.ALIEXPRESS, name: "AliExpress" },
  { pattern: /ebay\.(com|co\.uk|de|fr)/i, platform: ShopPlatform.EBAY, name: "eBay" },
  { pattern: /etsy\.com/i, platform: ShopPlatform.ETSY, name: "Etsy" },
  { pattern: /shein\.com/i, platform: ShopPlatform.SHEIN, name: "Shein" },
  { pattern: /temu\.com/i, platform: ShopPlatform.TEMU, name: "Temu" },
  { pattern: /walmart\.com/i, platform: ShopPlatform.WALMART, name: "Walmart" },
];

// Order ID patterns
const ORDER_ID_PATTERNS: RegExp[] = [
  /order\s*#?\s*:?\s*([A-Z0-9-]{5,30})/i,
  /order\s+number\s*:?\s*([A-Z0-9-]{5,30})/i,
  /confirmation\s*#?\s*:?\s*([A-Z0-9-]{5,30})/i,
  /(?:order|ref|reference)\s*(?:id|number|#)\s*:?\s*(\d{3}-\d{7}-\d{7})/i,
];

// Price patterns
const PRICE_PATTERNS: RegExp[] = [
  /(?:total|amount|grand total|order total)\s*:?\s*(?:US\s*)?\$\s*([\d,]+\.?\d*)/i,
  /(?:total|amount|grand total|order total)\s*:?\s*€\s*([\d,]+\.?\d*)/i,
  /(?:total|amount|grand total|order total)\s*:?\s*£\s*([\d,]+\.?\d*)/i,
  /(?:total|amount)\s*:?\s*([\d,]+\.?\d*)\s*(?:USD|EUR|GBP)/i,
];

// Status detection from subject/body
const STATUS_PATTERNS: Array<{ pattern: RegExp; status: PackageStatus }> = [
  { pattern: /has been delivered|successfully delivered|package delivered/i, status: PackageStatus.DELIVERED },
  { pattern: /ready for pickup|waiting to be picked up|awaiting collection/i, status: PackageStatus.OUT_FOR_DELIVERY },
  { pattern: /out for delivery/i, status: PackageStatus.OUT_FOR_DELIVERY },
  { pattern: /in your country|with local carrier|collected by local carrier/i, status: PackageStatus.OUT_FOR_DELIVERY },
  { pattern: /has cleared customs|clearing customs/i, status: PackageStatus.IN_TRANSIT },
  { pattern: /left the departure region|in global transit|in transit/i, status: PackageStatus.IN_TRANSIT },
  { pattern: /has an update|have delivery updates/i, status: PackageStatus.IN_TRANSIT },
  { pattern: /collected by the carrier/i, status: PackageStatus.SHIPPED },
  { pattern: /order shipped|has shipped|has been shipped|dispatched/i, status: PackageStatus.SHIPPED },
  { pattern: /ready to ship/i, status: PackageStatus.PROCESSING },
  { pattern: /delivery update/i, status: PackageStatus.IN_TRANSIT },
  { pattern: /awaiting confirmation|marked as completed/i, status: PackageStatus.DELIVERED },
  { pattern: /order confirmed|order placed/i, status: PackageStatus.ORDERED },
];

/**
 * Multi-layer email parser.
 * Layer 1: AliExpress-specific template parsing
 * Layer 2: Pattern matching for tracking numbers
 * Layer 3: HTML parsing for structured data
 */
export function parseEmail(emailHtml: string, fromAddress: string, subject: string): ParsedEmail {
  const $ = cheerio.load(emailHtml);
  $("style, script, head").remove();
  const textContent = $.text().replace(/\s+/g, " ").trim();
  const fullText = `${fromAddress} ${subject} ${textContent}`;

  // Detect merchant
  const merchant = detectMerchant(fromAddress, subject, textContent);

  // AliExpress-specific parsing (most of our emails)
  if (merchant.platform === ShopPlatform.ALIEXPRESS) {
    return parseAliExpressEmail(subject, textContent, fullText, merchant);
  }

  // Generic parsing for other merchants
  const trackingResults = extractTrackingNumbers(fullText);
  const primaryTracking = trackingResults[0] ?? null;
  const orderId = extractOrderId(fullText);
  const items = extractItemsFromHtml($);
  const { amount, currency } = extractPrice(fullText);
  const orderDate = extractDate(fullText);
  const status = detectStatus(subject, textContent);

  const confidence = calculateConfidence({
    hasMerchant: merchant.platform !== ShopPlatform.UNKNOWN,
    hasTracking: !!primaryTracking,
    hasOrderId: !!orderId,
    hasItems: items.length > 0,
  });

  return {
    merchant: merchant.name,
    platform: merchant.platform,
    orderId,
    trackingNumber: primaryTracking?.trackingNumber ?? null,
    carrier: primaryTracking?.carrier ?? null,
    items,
    orderDate,
    totalAmount: amount,
    currency,
    status,
    confidence,
  };
}

/**
 * AliExpress-specific email parser.
 * Handles: delivered, shipped, delivery update, awaiting confirmation, package updates
 */
function parseAliExpressEmail(
  subject: string,
  textContent: string,
  fullText: string,
  merchant: { platform: ShopPlatform; name: string }
): ParsedEmail {
  // 1. Extract tracking from subject ("Package RS1300705226Y has been delivered")
  const subjectTracking = extractTrackingFromSubject(subject);

  // 2. Extract order ID from subject or body
  const orderId = extractOrderId(fullText);

  // 3. Extract items from text content
  const items = extractAliExpressItems(textContent);

  // 4. Extract price
  const { amount, currency } = extractPrice(textContent);

  // 5. Detect status from subject
  const status = detectStatus(subject, textContent);

  // 6. Extract date
  const orderDate = extractAliExpressDate(textContent);

  // 7. Also try body tracking numbers
  let tracking = subjectTracking;
  if (!tracking) {
    const bodyTrackingResults = extractTrackingNumbers(fullText);
    tracking = bodyTrackingResults[0] ?? null;
  }
  // 8. Fallback: scan for AliExpress-style tracking in body (XX0000000000)
  if (!tracking) {
    const aliMatch = fullText.match(/\b([A-Z]{2}\d{9,17}[A-Z]{0,2})\b/);
    if (aliMatch) {
      const tn = aliMatch[1].toUpperCase();
      // Filter out order IDs (all digits after 2 letters, 16+ chars = likely order ID)
      if (tn.length <= 18 && !/^\d{10,}$/.test(tn)) {
        tracking = { trackingNumber: tn, carrier: detectCarrier(tn) };
      }
    }
  }

  const confidence = calculateConfidence({
    hasMerchant: true,
    hasTracking: !!tracking,
    hasOrderId: !!orderId,
    hasItems: items.length > 0,
  });

  return {
    merchant: merchant.name,
    platform: merchant.platform,
    orderId,
    trackingNumber: tracking?.trackingNumber ?? null,
    carrier: tracking?.carrier ?? null,
    items,
    orderDate,
    totalAmount: amount,
    currency,
    status,
    confidence,
  };
}

/**
 * Extract item descriptions from AliExpress email text.
 * Looks for patterns after "Package details" section.
 */
function extractAliExpressItems(text: string): string[] {
  const raw: string[] = [];

  // Pattern 1: Between "Package details" and "Ship to" / "Download" / end
  const packageDetailsIdx = text.indexOf("Package details");
  if (packageDetailsIdx >= 0) {
    const shipToIdx = text.indexOf("Ship to", packageDetailsIdx);
    const downloadIdx = text.indexOf("Download", packageDetailsIdx);
    const pricesIdx = text.indexOf("Prices,", packageDetailsIdx);
    const endIdx = Math.min(
      ...[shipToIdx, downloadIdx, pricesIdx, packageDetailsIdx + 2000].filter(i => i > 0)
    );
    const section = text.substring(packageDetailsIdx + 15, endIdx);

    // Split by dots used as separators in AliExpress emails
    const chunks = section.split(/\s*\.\s*/).filter(s => s.trim().length > 5);
    for (const chunk of chunks) {
      const cleaned = chunk.trim();
      // Skip status/navigation/boilerplate lines
      if (/^(Collected|In global|In your|View more|Track|Download|Prices|See more|Check|Package)/i.test(cleaned)) continue;
      if (/^(Ship|This email|You are|Visit|Questions)/i.test(cleaned)) continue;
      if (/^(Order|Placed|Payment|Order total|Order ID|More items)/i.test(cleaned)) continue;

      // Item-like text: starts with letter/number, at least 8 chars
      if (/^[A-Z0-9]/i.test(cleaned) && cleaned.length >= 8) {
        let item = cleaned.replace(/\s+China\s*(?:Mainland)?$/i, "").trim();
        item = item.replace(/\s+x\d+\s*$/, "").trim();
        // Skip short fragments (e.g. "9 grid D") and generic junk
        if (item.length >= 10) {
          raw.push(item);
        }
      }
    }
  }

  // Pattern 2: "Store_name Item_name..." in shipped emails
  if (raw.length === 0) {
    const storeItemMatch = text.match(/\b\w+\s+(?:Official\s+)?Store\s+([A-Z][A-Za-z0-9\s\/,()'".-]{10,100}?)(?:\.\.\.|China|x\d)/);
    if (storeItemMatch) {
      raw.push(storeItemMatch[1].trim());
    }
  }

  // Pattern 3: "order shipped" specific — after "Track order" button
  if (raw.length === 0) {
    const trackOrderIdx = text.indexOf("Track order");
    if (trackOrderIdx >= 0) {
      const afterTrack = text.substring(trackOrderIdx + 11, trackOrderIdx + 300);
      const itemMatch = afterTrack.match(/^\s*([A-Z][A-Za-z0-9\s\/,()'".-]{10,100}?)(?:\.\.\.|China|x\d)/);
      if (itemMatch) {
        raw.push(itemMatch[1].trim());
      }
    }
  }

  // Deduplicate items (case-insensitive)
  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of raw) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push(item);
    }
  }

  return items.slice(0, 10);
}

function extractAliExpressDate(text: string): string | null {
  // "Placed on Feb 16,2026, 15:22"
  const placedMatch = text.match(/Placed on\s+(\w+\s+\d{1,2},?\s*\d{4})/i);
  if (placedMatch) {
    try {
      const d = new Date(placedMatch[1]);
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch { /* fall through */ }
  }
  return extractDate(text);
}

function detectMerchant(
  from: string,
  subject: string,
  body: string
): { platform: ShopPlatform; name: string } {
  const combined = `${from} ${subject} ${body}`;
  for (const m of MERCHANT_PATTERNS) {
    if (m.pattern.test(combined)) {
      return { platform: m.platform, name: m.name };
    }
  }
  const fromMatch = from.match(/(?:from\s+)?([^<@]+)/i);
  const name = fromMatch?.[1]?.trim() ?? "Unknown Merchant";
  return { platform: ShopPlatform.UNKNOWN, name };
}

function extractOrderId(text: string): string | null {
  for (const pattern of ORDER_ID_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractItemsFromHtml($: cheerio.CheerioAPI): string[] {
  const items: string[] = [];
  const selectors = [
    'td[class*="item"]',
    'td[class*="product"]',
    'div[class*="item-name"]',
    'span[class*="product-name"]',
    'a[class*="item"]',
  ];
  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 2 && text.length < 200) {
        items.push(text);
      }
    });
    if (items.length > 0) break;
  }
  return items.slice(0, 10);
}

function extractPrice(text: string): { amount: number | null; currency: string | null } {
  for (const pattern of PRICE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const amount = parseFloat(match[1].replace(",", ""));
      let currency = "USD";
      if (text.includes("€")) currency = "EUR";
      if (text.includes("£")) currency = "GBP";
      return { amount, currency };
    }
  }
  return { amount: null, currency: null };
}

function extractDate(text: string): string | null {
  const datePatterns = [
    /(?:order|placed|date)\s*:?\s*(\w+\s+\d{1,2},?\s+\d{4})/i,
    /(?:order|placed|date)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /(?:order|placed|date)\s*:?\s*(\d{4}-\d{2}-\d{2})/i,
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      try {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime())) return date.toISOString();
      } catch { continue; }
    }
  }
  return null;
}

function detectStatus(subject: string, body: string): PackageStatus | null {
  const combined = `${subject} ${body}`;
  for (const { pattern, status } of STATUS_PATTERNS) {
    if (pattern.test(combined)) return status;
  }
  return null;
}

function calculateConfidence(factors: {
  hasMerchant: boolean;
  hasTracking: boolean;
  hasOrderId: boolean;
  hasItems: boolean;
}): number {
  let score = 0;
  if (factors.hasMerchant) score += 0.3;
  if (factors.hasTracking) score += 0.3;
  if (factors.hasOrderId) score += 0.2;
  if (factors.hasItems) score += 0.2;
  return score;
}
