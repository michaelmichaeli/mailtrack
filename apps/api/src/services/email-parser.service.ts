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
  { pattern: /iherb\.com/i, platform: ShopPlatform.IHERB, name: "iHerb" },
  { pattern: /zara\.com/i, platform: ShopPlatform.ZARA, name: "Zara" },
  { pattern: /asos\.com/i, platform: ShopPlatform.ASOS, name: "ASOS" },
  { pattern: /next\.co\.uk|nextdirect\.com/i, platform: ShopPlatform.NEXT, name: "Next" },
  { pattern: /hm\.com|h&m/i, platform: ShopPlatform.HM, name: "H&M" },
  { pattern: /shopify\.com|myshopify\.com/i, platform: ShopPlatform.SHOPIFY, name: "Shopify Store" },
];

// Order ID patterns
const ORDER_ID_PATTERNS: RegExp[] = [
  /order\s*#?\s*:?\s*([A-Z0-9-]{5,30})/i,
  /order\s+number\s*:?\s*([A-Z0-9-]{5,30})/i,
  /confirmation\s*#?\s*:?\s*([A-Z0-9-]{5,30})/i,
  /(?:order|ref|reference)\s*(?:id|number|#)\s*:?\s*(\d{3}-\d{7}-\d{7})/i, // Amazon
  /(?:order|ref|reference)\s*(?:id|number|#)\s*:?\s*(\d{2}-\d{5}-\d{5})/i, // eBay
  /(?:order|ref|reference)\s*(?:id|number|#)\s*:?\s*([A-Z]{2}\d{10,15})/i, // Shein/Temu
  /(?:your order|order)\s*(?:no|number)?\.?\s*:?\s*#?([A-Z0-9]{8,20})/i, // Generic
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
  // Delivered
  { pattern: /has been delivered|successfully delivered|package delivered/i, status: PackageStatus.DELIVERED },
  { pattern: /your order has been delivered|delivery confirmed/i, status: PackageStatus.DELIVERED },
  { pattern: /left at|left with|handed to/i, status: PackageStatus.DELIVERED },
  // Out for delivery / pickup
  { pattern: /ready for pickup|waiting to be picked up|awaiting collection/i, status: PackageStatus.OUT_FOR_DELIVERY },
  { pattern: /out for delivery|arriving today/i, status: PackageStatus.OUT_FOR_DELIVERY },
  { pattern: /in your country|with local carrier|collected by local carrier/i, status: PackageStatus.OUT_FOR_DELIVERY },
  { pattern: /delivery attempt|attempted delivery/i, status: PackageStatus.OUT_FOR_DELIVERY },
  // In transit
  { pattern: /has cleared customs|clearing customs/i, status: PackageStatus.IN_TRANSIT },
  { pattern: /left the departure region|in global transit|in transit/i, status: PackageStatus.IN_TRANSIT },
  { pattern: /has an update|have delivery updates/i, status: PackageStatus.IN_TRANSIT },
  { pattern: /on its way|on the way|en route/i, status: PackageStatus.IN_TRANSIT },
  { pattern: /arrived at|departed from|processed through/i, status: PackageStatus.IN_TRANSIT },
  { pattern: /delivery update/i, status: PackageStatus.IN_TRANSIT },
  // Shipped
  { pattern: /collected by the carrier/i, status: PackageStatus.SHIPPED },
  { pattern: /order shipped|has shipped|has been shipped|dispatched/i, status: PackageStatus.SHIPPED },
  { pattern: /shipment confirmed|label created|shipping confirmation/i, status: PackageStatus.SHIPPED },
  // Processing
  { pattern: /ready to ship|preparing for shipment|preparing your order/i, status: PackageStatus.PROCESSING },
  { pattern: /order processing|being prepared/i, status: PackageStatus.PROCESSING },
  // Other
  { pattern: /awaiting confirmation|marked as completed/i, status: PackageStatus.DELIVERED },
  { pattern: /order confirmed|order placed|thank you for your order/i, status: PackageStatus.ORDERED },
  { pattern: /refund|refunded|return accepted/i, status: PackageStatus.RETURNED },
  { pattern: /delivery exception|delivery failed|unable to deliver/i, status: PackageStatus.EXCEPTION },
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

  // Parcel Home (Cainiao Israel) — pickup location emails
  if (fromAddress.toLowerCase().includes("parcelhome") || fromAddress.toLowerCase().includes("parcel home")) {
    return parseParcelHomeEmail(subject, textContent, fullText, merchant);
  }

  // AliExpress-specific parsing (most of our emails)
  if (merchant.platform === ShopPlatform.ALIEXPRESS) {
    return parseAliExpressEmail(subject, textContent, fullText, merchant);
  }

  // Amazon-specific parsing
  if (merchant.platform === ShopPlatform.AMAZON) {
    return parseAmazonEmail($, subject, textContent, fullText, merchant);
  }

  // eBay-specific parsing
  if (merchant.platform === ShopPlatform.EBAY) {
    return parseEbayEmail($, subject, textContent, fullText, merchant);
  }

  // iHerb-specific parsing
  if (merchant.platform === ShopPlatform.IHERB) {
    return parseIherbEmail($, subject, textContent, fullText, merchant);
  }

  // Shein-specific parsing
  if (merchant.platform === ShopPlatform.SHEIN) {
    return parseSheinEmail($, subject, textContent, fullText, merchant);
  }

  // Temu-specific parsing
  if (merchant.platform === ShopPlatform.TEMU) {
    return parseTemuEmail($, subject, textContent, fullText, merchant);
  }

  // Shopify store emails (generic)
  if (merchant.platform === ShopPlatform.SHOPIFY) {
    return parseShopifyEmail($, subject, textContent, fullText, merchant);
  }

  // Generic parsing for other merchants
  const trackingResults = extractTrackingNumbers(fullText);
  let primaryTracking = trackingResults[0] ?? null;

  // Fallback: extract tracking from URL params in links
  if (!primaryTracking) {
    let tn: string | null = null;
    $('a[href]').each((_, el) => {
      if (tn) return;
      const href = $(el).attr('href') || '';
      const m = href.match(/track(?:ing)?(?:Number|Num|Id|_number|_id)?[=\/]([A-Z0-9]{8,25})/i);
      if (m) tn = m[1].toUpperCase();
    });
    if (tn) primaryTracking = { trackingNumber: tn, carrier: detectCarrier(tn) };
  }
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
    pickupLocation: null,
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
    pickupLocation: null,
    confidence,
  };
}

/**
 * Parcel Home (Cainiao Israel) email parser.
 * These emails are in Hebrew and contain pickup location data:
 * address, opening hours, pickup code, verification code.
 */
function parseParcelHomeEmail(
  subject: string,
  textContent: string,
  fullText: string,
  merchant: { platform: ShopPlatform; name: string }
): ParsedEmail {
  // Extract tracking number from text (format: PH8002540186)
  const subjectTracking = extractTrackingFromSubject(subject);
  let tracking = subjectTracking;
  if (!tracking) {
    const bodyTrackingResults = extractTrackingNumbers(fullText);
    tracking = bodyTrackingResults[0] ?? null;
  }

  // Hebrew RTL patterns for pickup data
  // Address: text before כתובת:
  let address: string | null = null;
  const addressMatch = textContent.match(/כתובת\s*:?\s*([^\n:]+?)(?:\s*שעות|\s*קוד|\s*$)/);
  if (addressMatch) {
    address = addressMatch[1].trim();
  }
  if (!address) {
    const addressMatch2 = textContent.match(/([^:]{5,60})\s*:\s*כתובת/);
    if (addressMatch2) {
      address = addressMatch2[1].trim();
    }
  }

  // Opening hours
  let hours: string | null = null;
  const hoursMatch = textContent.match(/שעות פתיחה\s*:?\s*([^\n]+?)(?:\s*כתובת|\s*קוד|\s*$)/);
  if (hoursMatch) {
    hours = hoursMatch[1].trim();
  }
  if (!hours) {
    const hoursMatch2 = textContent.match(/([^:]{5,120})\s*:\s*שעות פתיחה/);
    if (hoursMatch2) {
      hours = hoursMatch2[1].trim();
    }
  }

  // Pickup code (format: X-Y-ZZZZ-WW)
  let pickupCode: string | null = null;
  const pickupCodeMatch = textContent.match(/(\d+-\d+-\d+-\d+)\s*:?\s*קוד איסוף/);
  if (pickupCodeMatch) {
    pickupCode = pickupCodeMatch[1];
  }
  if (!pickupCode) {
    const pickupCodeMatch2 = textContent.match(/קוד איסוף\s*:?\s*(\d+-\d+-\d+-\d+)/);
    if (pickupCodeMatch2) {
      pickupCode = pickupCodeMatch2[1];
    }
  }

  // Verification code (4-6 digit code)
  let verificationCode: string | null = null;
  const verMatch = textContent.match(/קוד אימות\s*:?\s*(\d{4,6})/);
  if (verMatch) {
    verificationCode = verMatch[1];
  }
  if (!verificationCode) {
    const verMatch2 = textContent.match(/(\d{4,6})\s*:?\s*קוד אימות/);
    if (verMatch2) {
      verificationCode = verMatch2[1];
    }
  }

  const pickupLocation = address ? {
    address,
    hours: hours ?? "",
    pickupCode,
    verificationCode,
  } : null;

  const status = detectStatus(subject, textContent) ?? PackageStatus.OUT_FOR_DELIVERY;

  const confidence = calculateConfidence({
    hasMerchant: true,
    hasTracking: !!tracking,
    hasOrderId: false,
    hasItems: false,
  });

  return {
    merchant: "Cainiao / Parcel Home",
    platform: ShopPlatform.ALIEXPRESS,
    orderId: null,
    trackingNumber: tracking?.trackingNumber ?? null,
    carrier: tracking?.carrier ?? null,
    items: [],
    orderDate: null,
    totalAmount: null,
    currency: null,
    status,
    pickupLocation,
    confidence,
  };
}

/**
 * Amazon email parser.
 * Handles: order confirmations, shipping notifications, delivery updates, return confirmations.
 * Amazon order IDs: 123-1234567-1234567
 */
function parseAmazonEmail(
  $: cheerio.CheerioAPI,
  subject: string,
  textContent: string,
  fullText: string,
  merchant: { platform: ShopPlatform; name: string }
): ParsedEmail {
  // Amazon order ID format: 123-1234567-1234567
  let orderId: string | null = null;
  const amazonOrderMatch = fullText.match(/(\d{3}-\d{7}-\d{7})/);
  if (amazonOrderMatch) orderId = amazonOrderMatch[1];

  // Extract tracking — Amazon uses various carriers
  const trackingResults = extractTrackingNumbers(fullText);
  let tracking = trackingResults[0] ?? null;

  // Amazon sometimes puts tracking in specific elements
  if (!tracking) {
    const trackLink = $('a[href*="tracking"]').first().attr("href") ?? "";
    const tnMatch = trackLink.match(/tracknum=([A-Z0-9]+)/i) ?? trackLink.match(/tracking[/-]([A-Z0-9]+)/i);
    if (tnMatch) {
      const tn = tnMatch[1].toUpperCase();
      tracking = { trackingNumber: tn, carrier: detectCarrier(tn) };
    }
  }

  // Extract items — Amazon uses table rows or specific classes
  let items: string[] = [];
  $('td[class*="name"], td[class*="item"], a[class*="item"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 5 && text.length < 200 && !/\$|order|total|subtotal|shipping/i.test(text)) {
      items.push(text);
    }
  });
  if (items.length === 0) items = extractItemsFromHtml($);
  if (items.length === 0) {
    // Fallback: extract from subject "Your order of ITEM has shipped"
    const subjectItem = subject.match(/(?:your order of|your .+ order)\s+(.{5,80}?)(?:\s+has|\s+will|\s+is)/i);
    if (subjectItem) items.push(subjectItem[1].trim());
  }

  const { amount, currency } = extractPrice(fullText);
  const status = detectStatus(subject, textContent);

  // Amazon-specific status patterns
  let amazonStatus = status;
  if (!amazonStatus) {
    if (/your order has been delivered/i.test(fullText)) amazonStatus = PackageStatus.DELIVERED;
    else if (/arriving\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(fullText)) amazonStatus = PackageStatus.OUT_FOR_DELIVERY;
    else if (/shipped|on its way/i.test(fullText)) amazonStatus = PackageStatus.SHIPPED;
    else if (/order confirmed|thank you for your order/i.test(fullText)) amazonStatus = PackageStatus.ORDERED;
    else if (/preparing for shipment|preparing your order/i.test(fullText)) amazonStatus = PackageStatus.PROCESSING;
    else if (/refund|returned/i.test(fullText)) amazonStatus = PackageStatus.RETURNED;
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
    orderDate: extractDate(fullText),
    totalAmount: amount,
    currency,
    status: amazonStatus,
    pickupLocation: null,
    confidence,
  };
}

/**
 * eBay email parser.
 * Handles: order confirmations, shipping notifications, delivery updates.
 * eBay item numbers: 12-digit numbers, order IDs: XX-XXXXX-XXXXX
 */
function parseEbayEmail(
  $: cheerio.CheerioAPI,
  subject: string,
  textContent: string,
  fullText: string,
  merchant: { platform: ShopPlatform; name: string }
): ParsedEmail {
  // eBay order ID formats
  let orderId: string | null = null;
  const ebayOrderMatch = fullText.match(/(\d{2}-\d{5}-\d{5})/);
  if (ebayOrderMatch) orderId = ebayOrderMatch[1];
  if (!orderId) {
    const itemMatch = fullText.match(/item\s*(?:number|#|id)\s*:?\s*(\d{10,14})/i);
    if (itemMatch) orderId = itemMatch[1];
  }

  const trackingResults = extractTrackingNumbers(fullText);
  const tracking = trackingResults[0] ?? null;

  let items: string[] = [];
  // eBay item title from subject: "You bought ITEM_NAME"
  const subjectItem = subject.match(/(?:you bought|you won|item shipped)\s*:?\s*(.{5,100})/i);
  if (subjectItem) items.push(subjectItem[1].trim());
  if (items.length === 0) items = extractItemsFromHtml($);

  const { amount, currency } = extractPrice(fullText);
  const status = detectStatus(subject, textContent);

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
    orderDate: extractDate(fullText),
    totalAmount: amount,
    currency,
    status,
    pickupLocation: null,
    confidence,
  };
}

/**
 * iHerb email parser.
 * Handles: order confirmations, shipping notifications.
 * iHerb order IDs: typically 8-10 digit numbers.
 */
function parseIherbEmail(
  $: cheerio.CheerioAPI,
  subject: string,
  textContent: string,
  fullText: string,
  merchant: { platform: ShopPlatform; name: string }
): ParsedEmail {
  // iHerb order ID
  let orderId = extractOrderId(fullText);
  if (!orderId) {
    const iherbMatch = fullText.match(/order\s*#?\s*:?\s*(\d{8,10})/i);
    if (iherbMatch) orderId = iherbMatch[1];
  }

  const trackingResults = extractTrackingNumbers(fullText);
  let tracking = trackingResults[0] ?? null;

  // iHerb puts tracking in URL params (trackingNumber=GAIH50740763)
  if (!tracking) {
    let tn: string | null = null;
    $('a[href]').each((_, el) => {
      if (tn) return;
      const href = $(el).attr('href') || '';
      const m = href.match(/trackingNumber=([A-Z0-9]{8,25})/i);
      if (m) tn = m[1].toUpperCase();
    });
    if (tn) tracking = { trackingNumber: tn, carrier: detectCarrier(tn) };
  }

  // iHerb items from table
  let items: string[] = [];
  $('td, span, div').each((_, el) => {
    const text = $(el).text().trim();
    // iHerb products often have brand names and supplement descriptions
    if (text.length > 10 && text.length < 150 && /\d+\s*(mg|g|oz|ml|capsules?|tablets?|softgels?)/i.test(text)) {
      items.push(text.replace(/\s+/g, ' '));
    }
  });
  if (items.length === 0) items = extractItemsFromHtml($);

  const { amount, currency } = extractPrice(fullText);
  const status = detectStatus(subject, textContent);

  let iherbStatus = status;
  if (!iherbStatus) {
    if (/your order has shipped|shipment confirmation/i.test(fullText)) iherbStatus = PackageStatus.SHIPPED;
    else if (/order confirmation|thank you for your order/i.test(fullText)) iherbStatus = PackageStatus.ORDERED;
    else if (/delivered/i.test(fullText)) iherbStatus = PackageStatus.DELIVERED;
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
    items: [...new Set(items)].slice(0, 10),
    orderDate: extractDate(fullText),
    totalAmount: amount,
    currency,
    status: iherbStatus,
    pickupLocation: null,
    confidence,
  };
}

/**
 * Shein email parser.
 * Handles: order confirmations, shipping updates, delivery notifications.
 */
function parseSheinEmail(
  $: cheerio.CheerioAPI,
  subject: string,
  textContent: string,
  fullText: string,
  merchant: { platform: ShopPlatform; name: string }
): ParsedEmail {
  let orderId = extractOrderId(fullText);
  // Shein order IDs are typically long numbers
  if (!orderId) {
    const sheinMatch = fullText.match(/order\s*(?:number|#|id)?\s*:?\s*([A-Z0-9]{10,20})/i);
    if (sheinMatch) orderId = sheinMatch[1];
  }

  const trackingResults = extractTrackingNumbers(fullText);
  const tracking = trackingResults[0] ?? null;

  let items = extractItemsFromHtml($);
  // Shein uses product images with alt text
  if (items.length === 0) {
    $('img[alt]').each((_, el) => {
      const alt = $(el).attr('alt')?.trim() ?? '';
      if (alt.length > 10 && alt.length < 150 && !/logo|banner|icon|button/i.test(alt)) {
        items.push(alt);
      }
    });
  }

  const { amount, currency } = extractPrice(fullText);
  const status = detectStatus(subject, textContent);

  let sheinStatus = status;
  if (!sheinStatus) {
    if (/package has been shipped|your package is on its way/i.test(fullText)) sheinStatus = PackageStatus.SHIPPED;
    else if (/order received|order confirmed/i.test(fullText)) sheinStatus = PackageStatus.ORDERED;
    else if (/delivered/i.test(fullText)) sheinStatus = PackageStatus.DELIVERED;
    else if (/customs/i.test(fullText)) sheinStatus = PackageStatus.IN_TRANSIT;
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
    items: items.slice(0, 10),
    orderDate: extractDate(fullText),
    totalAmount: amount,
    currency,
    status: sheinStatus,
    pickupLocation: null,
    confidence,
  };
}

/**
 * Temu email parser.
 * Handles: order confirmations, shipping updates, delivery notifications.
 */
function parseTemuEmail(
  $: cheerio.CheerioAPI,
  subject: string,
  textContent: string,
  fullText: string,
  merchant: { platform: ShopPlatform; name: string }
): ParsedEmail {
  let orderId = extractOrderId(fullText);
  if (!orderId) {
    const temuMatch = fullText.match(/(?:order|PO)\s*(?:number|#|id)?\s*:?\s*([A-Z0-9-]{8,25})/i);
    if (temuMatch) orderId = temuMatch[1];
  }

  const trackingResults = extractTrackingNumbers(fullText);
  const tracking = trackingResults[0] ?? null;

  let items = extractItemsFromHtml($);
  if (items.length === 0) {
    // Temu often uses image alt text for product names
    $('img[alt]').each((_, el) => {
      const alt = $(el).attr('alt')?.trim() ?? '';
      if (alt.length > 10 && alt.length < 150 && !/logo|banner|icon|button/i.test(alt)) {
        items.push(alt);
      }
    });
  }

  const { amount, currency } = extractPrice(fullText);
  const status = detectStatus(subject, textContent);

  let temuStatus = status;
  if (!temuStatus) {
    if (/your package is on its way|shipped/i.test(fullText)) temuStatus = PackageStatus.SHIPPED;
    else if (/order placed|order confirmed/i.test(fullText)) temuStatus = PackageStatus.ORDERED;
    else if (/delivered/i.test(fullText)) temuStatus = PackageStatus.DELIVERED;
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
    items: items.slice(0, 10),
    orderDate: extractDate(fullText),
    totalAmount: amount,
    currency,
    status: temuStatus,
    pickupLocation: null,
    confidence,
  };
}

/**
 * Shopify store email parser (generic — covers thousands of Shopify-powered stores).
 * Handles: order confirmations, shipping updates from any Shopify store.
 */
function parseShopifyEmail(
  $: cheerio.CheerioAPI,
  subject: string,
  textContent: string,
  fullText: string,
  merchant: { platform: ShopPlatform; name: string }
): ParsedEmail {
  // Shopify order IDs: #1001, #12345, etc.
  let orderId = extractOrderId(fullText);
  if (!orderId) {
    const shopifyMatch = fullText.match(/order\s*#?\s*(\d{3,8})/i);
    if (shopifyMatch) orderId = shopifyMatch[1];
  }

  const trackingResults = extractTrackingNumbers(fullText);
  const tracking = trackingResults[0] ?? null;

  // Shopify uses structured HTML tables for items
  let items: string[] = [];
  $('table td').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 5 && text.length < 200 && !/\$|total|subtotal|shipping|tax|qty/i.test(text)) {
      // Check if it looks like a product name (has letters)
      if (/[a-zA-Z]{3,}/.test(text)) {
        items.push(text.replace(/\s+/g, ' '));
      }
    }
  });
  if (items.length === 0) items = extractItemsFromHtml($);

  // Try to extract store name from subject or "from" field
  let storeName = merchant.name;
  const storeMatch = subject.match(/(?:from|at)\s+(.+?)(?:\s*[-–—]|\s*order|\s*#|$)/i);
  if (storeMatch) storeName = storeMatch[1].trim();

  const { amount, currency } = extractPrice(fullText);
  const status = detectStatus(subject, textContent);

  const confidence = calculateConfidence({
    hasMerchant: true,
    hasTracking: !!tracking,
    hasOrderId: !!orderId,
    hasItems: items.length > 0,
  });

  return {
    merchant: storeName,
    platform: merchant.platform,
    orderId,
    trackingNumber: tracking?.trackingNumber ?? null,
    carrier: tracking?.carrier ?? null,
    items: [...new Set(items)].slice(0, 10),
    orderDate: extractDate(fullText),
    totalAmount: amount,
    currency,
    status,
    pickupLocation: null,
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
