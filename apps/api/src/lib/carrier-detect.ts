import { Carrier, CARRIER_PATTERNS } from "@mailtrack/shared";

/**
 * Auto-detect carrier from tracking number format.
 * Returns the most likely carrier based on regex pattern matching.
 */
export function detectCarrier(trackingNumber: string): Carrier {
  const normalized = trackingNumber.trim().toUpperCase();

  // UPS: 1Z followed by 16 alphanumeric chars
  if (CARRIER_PATTERNS.UPS.test(normalized)) return Carrier.UPS;

  // USPS: starts with 9 and is 20-26 digits, or international format
  if (CARRIER_PATTERNS.USPS.test(normalized)) return Carrier.USPS;

  // Royal Mail: 2 letters + 9 digits + GB
  if (CARRIER_PATTERNS.ROYAL_MAIL.test(normalized)) return Carrier.ROYAL_MAIL;

  // Yanwen: Y + letter + 9 digits + 2 letters
  if (CARRIER_PATTERNS.YANWEN.test(normalized)) return Carrier.YANWEN;

  // Cainiao: LP or CAINIAO prefix
  if (CARRIER_PATTERNS.CAINIAO.test(normalized)) return Carrier.CAINIAO;

  // FedEx: 12, 15, or 20 digits
  if (/^\d{12}$/.test(normalized) || /^\d{15}$/.test(normalized) || /^\d{20}$/.test(normalized)) {
    return Carrier.FEDEX;
  }

  // DHL: 10 or 20 digits, or letter prefix
  if (/^\d{10}$/.test(normalized) || /^[A-Z]{3}\d{7,20}$/.test(normalized)) {
    return Carrier.DHL;
  }

  // DPD: 14 digits
  if (/^\d{14}$/.test(normalized)) return Carrier.DPD;

  return Carrier.UNKNOWN;
}

/**
 * Extract all tracking numbers from text.
 */
export function extractTrackingNumbers(text: string): Array<{ trackingNumber: string; carrier: Carrier }> {
  const results: Array<{ trackingNumber: string; carrier: Carrier }> = [];
  const seen = new Set<string>();

  for (const [carrierName, pattern] of Object.entries(CARRIER_PATTERNS)) {
    const globalPattern = new RegExp(pattern.source, "gi");
    let match;
    while ((match = globalPattern.exec(text)) !== null) {
      const trackingNumber = match[0].toUpperCase();
      if (!seen.has(trackingNumber)) {
        seen.add(trackingNumber);
        results.push({
          trackingNumber,
          carrier: Carrier[carrierName as keyof typeof Carrier] ?? Carrier.UNKNOWN,
        });
      }
    }
  }

  return results;
}
