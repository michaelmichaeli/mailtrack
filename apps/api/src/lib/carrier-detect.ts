import { Carrier, CARRIER_PATTERNS } from "@mailtrack/shared";

/**
 * Auto-detect carrier from tracking number format.
 * Checks specific carriers first, then falls back to generic.
 */
export function detectCarrier(trackingNumber: string): Carrier {
  const n = trackingNumber.trim().toUpperCase();

  if (CARRIER_PATTERNS.UPS.test(n)) return Carrier.UPS;
  if (CARRIER_PATTERNS.USPS.test(n)) return Carrier.USPS;
  if (CARRIER_PATTERNS.ROYAL_MAIL.test(n)) return Carrier.ROYAL_MAIL;
  if (CARRIER_PATTERNS.YANWEN.test(n)) return Carrier.YANWEN;
  if (CARRIER_PATTERNS.CAINIAO.test(n)) return Carrier.CAINIAO;
  if (/^\d{12}$/.test(n) || /^\d{15}$/.test(n) || /^\d{20}$/.test(n)) return Carrier.FEDEX;
  if (/^[A-Z]{3}\d{7,20}$/.test(n)) return Carrier.DHL;
  if (/^\d{14}$/.test(n)) return Carrier.DPD;
  if (CARRIER_PATTERNS.ALIEXPRESS_STANDARD.test(n)) return Carrier.ALIEXPRESS_STANDARD;

  return Carrier.UNKNOWN;
}

// Words that precede phone numbers — used to filter false positives
const PHONE_CONTEXT = /(?:phone|tel|mobile|fax|call|whatsapp|\(\+?\d{1,3}\))\s*/i;

/**
 * Extract tracking number from AliExpress email subject line.
 * Patterns: "Package RS1300705226Y has been delivered", "Package AE039583535 has been shipped"
 */
export function extractTrackingFromSubject(subject: string): { trackingNumber: string; carrier: Carrier } | null {
  const match = subject.match(/Package\s+([A-Z]{2}\d{9,13}[A-Z]?)\s+/i);
  if (match) {
    const tn = match[1].toUpperCase();
    return { trackingNumber: tn, carrier: detectCarrier(tn) };
  }
  return null;
}

/**
 * Extract all tracking numbers from text, filtering out phone numbers and order IDs.
 */
export function extractTrackingNumbers(text: string): Array<{ trackingNumber: string; carrier: Carrier }> {
  const results: Array<{ trackingNumber: string; carrier: Carrier }> = [];
  const seen = new Set<string>();

  // Check specific carriers first (not ALIEXPRESS_STANDARD — too broad for body text)
  const specificCarriers = ["UPS", "USPS", "ROYAL_MAIL", "YANWEN", "CAINIAO", "DHL"];

  for (const carrierName of specificCarriers) {
    const pattern = CARRIER_PATTERNS[carrierName];
    if (!pattern) continue;
    const globalPattern = new RegExp(pattern.source, "gi");
    let match;
    while ((match = globalPattern.exec(text)) !== null) {
      const trackingNumber = match[0].toUpperCase();
      if (seen.has(trackingNumber)) continue;

      // Filter: skip if preceded by phone-related context
      const before = text.substring(Math.max(0, match.index - 30), match.index);
      if (PHONE_CONTEXT.test(before)) continue;

      // Filter: skip pure 10-digit numbers (too likely to be phone numbers)
      if (/^\d{10}$/.test(trackingNumber)) continue;

      seen.add(trackingNumber);
      results.push({
        trackingNumber,
        carrier: Carrier[carrierName as keyof typeof Carrier] ?? Carrier.UNKNOWN,
      });
    }
  }

  return results;
}
