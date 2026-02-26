import * as cheerio from "cheerio";
import { extractTrackingNumbers } from "../lib/carrier-detect.js";
import type { ParsedEmail } from "@mailtrack/shared";
import { ShopPlatform, Carrier } from "@mailtrack/shared";

// Merchant detection patterns
const MERCHANT_PATTERNS: Array<{ pattern: RegExp; platform: ShopPlatform; name: string }> = [
  { pattern: /amazon\.(com|co\.uk|de|fr|it|es|ca|com\.au|co\.jp)/i, platform: ShopPlatform.AMAZON, name: "Amazon" },
  { pattern: /aliexpress\.com/i, platform: ShopPlatform.ALIEXPRESS, name: "AliExpress" },
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
  /(?:order|ref|reference)\s*(?:id|number|#)\s*:?\s*(\d{3}-\d{7}-\d{7})/i, // Amazon format
];

// Price patterns
const PRICE_PATTERNS: RegExp[] = [
  /(?:total|amount|grand total)\s*:?\s*\$\s*([\d,]+\.?\d*)/i,
  /(?:total|amount|grand total)\s*:?\s*€\s*([\d,]+\.?\d*)/i,
  /(?:total|amount|grand total)\s*:?\s*£\s*([\d,]+\.?\d*)/i,
  /(?:total|amount)\s*:?\s*([\d,]+\.?\d*)\s*(?:USD|EUR|GBP)/i,
];

/**
 * Multi-layer email parser.
 * Layer 1: Pattern matching for tracking numbers
 * Layer 2: HTML parsing for structured data
 * Layer 3: LLM fallback (stub for now)
 */
export function parseEmail(emailHtml: string, fromAddress: string, subject: string): ParsedEmail {
  const $ = cheerio.load(emailHtml);
  const textContent = $.text();
  const fullText = `${fromAddress} ${subject} ${textContent}`;

  // Detect merchant
  const merchant = detectMerchant(fromAddress, subject, textContent);

  // Extract tracking numbers (Layer 1)
  const trackingResults = extractTrackingNumbers(fullText);
  const primaryTracking = trackingResults[0] ?? null;

  // Extract order ID (Layer 2)
  const orderId = extractOrderId(fullText);

  // Extract items from HTML tables
  const items = extractItems($);

  // Extract price
  const { amount, currency } = extractPrice(fullText);

  // Extract dates
  const orderDate = extractDate(fullText);

  // Calculate confidence
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
    confidence,
  };
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

  // Try to extract merchant from the "from" address
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

function extractItems($: cheerio.CheerioAPI): string[] {
  const items: string[] = [];

  // Common selectors for item names in order emails
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

  return items.slice(0, 10); // Max 10 items
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
  // Look for common date formats near "order" or "date" keywords
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
      } catch {
        continue;
      }
    }
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

/**
 * Template-based parsers for top merchants.
 * These provide higher accuracy for known email formats.
 */
export const merchantTemplates: Record<string, (html: string, subject: string) => Partial<ParsedEmail>> = {
  amazon: (html, subject) => {
    const $ = cheerio.load(html);
    const orderId = $.text().match(/(\d{3}-\d{7}-\d{7})/)?.[1] ?? null;
    const items: string[] = [];
    $('a[href*="/dp/"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 2) items.push(text);
    });
    return {
      merchant: "Amazon",
      platform: ShopPlatform.AMAZON,
      orderId,
      items,
    };
  },

  aliexpress: (html, subject) => {
    const $ = cheerio.load(html);
    const orderId = $.text().match(/order\s*(?:number|ID|#)\s*:?\s*(\d{15,20})/i)?.[1] ?? null;
    return {
      merchant: "AliExpress",
      platform: ShopPlatform.ALIEXPRESS,
      orderId,
    };
  },

  ebay: (html, subject) => {
    const $ = cheerio.load(html);
    const orderId = $.text().match(/(?:order|transaction)\s*(?:number|ID|#)\s*:?\s*(\d{2}-\d{5}-\d{5})/i)?.[1] ?? null;
    return {
      merchant: "eBay",
      platform: ShopPlatform.EBAY,
      orderId,
    };
  },

  etsy: (html, subject) => {
    const $ = cheerio.load(html);
    const orderId = $.text().match(/order\s*#?\s*(\d{10,15})/i)?.[1] ?? null;
    return {
      merchant: "Etsy",
      platform: ShopPlatform.ETSY,
      orderId,
    };
  },
};
