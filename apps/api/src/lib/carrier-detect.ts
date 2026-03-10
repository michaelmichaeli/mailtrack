import { CARRIER_PATTERNS } from "@mailtrack/shared";

/**
 * Auto-detect carrier from tracking number format.
 * Dynamically checks all patterns in CARRIER_PATTERNS — adding a new
 * carrier is just adding an entry to the patterns map, no code changes needed.
 */
export function detectCarrier(trackingNumber: string): string {
  const n = trackingNumber.trim().toUpperCase();

  // Skip numbers matching common phone patterns before checking carriers
  if (PHONE_PATTERNS.some((p) => p.test(n))) return "UNKNOWN";

  for (const [carrier, pattern] of Object.entries(CARRIER_PATTERNS)) {
    if (pattern.test(n)) return carrier;
  }

  return "UNKNOWN";
}

// Words that precede phone numbers — used to filter false positives
const PHONE_CONTEXT = /(?:phone|tel|mobile|fax|call|whatsapp|contact|סלולרי|טלפון|נייד|\(\+?\d{1,3}\))\s*/i;

// Common phone number patterns that should never be treated as tracking numbers
// Israeli: 972XXXXXXXXX (12 digits), international: country codes starting with known prefixes
const PHONE_PATTERNS = [
  /^972\d{8,9}$/, // Israeli international format: 972-5X-XXX-XXXX
  /^1[2-9]\d{9}$/, // US/Canada phone: 1XXXXXXXXXX (11 digits)
  /^44\d{10}$/,    // UK phone: 44XXXXXXXXXX (12 digits)
  /^49\d{10,11}$/, // German phone
  /^33\d{9,10}$/,  // French phone
  /^86\d{11}$/,    // Chinese phone
  /^91\d{10}$/,    // Indian phone
];

/**
 * Extract tracking number from AliExpress/Cainiao email subject line.
 * Patterns: "Package RS1300705226Y has been delivered", "Package PH8002545065: with local carrier",
 *           "Package AP00797874896401 has an update", "Package BR004638448MG: collected by the carrier"
 */
export function extractTrackingFromSubject(subject: string): { trackingNumber: string; carrier: string } | null {
  // Match "Package TRACKINGNUM" — letters+digits combo, followed by space/colon/end
  const match = subject.match(/Package\s+([A-Z]{2}\d{9,17}[A-Z]{0,2})(?:[\s:]|$)/i);
  if (match) {
    const tn = match[1].toUpperCase();
    return { trackingNumber: tn, carrier: detectCarrier(tn) };
  }
  return null;
}

/**
 * Extract all tracking numbers from text, filtering out phone numbers and order IDs.
 */
export function extractTrackingNumbers(text: string): Array<{ trackingNumber: string; carrier: string }> {
  const results: Array<{ trackingNumber: string; carrier: string }> = [];
  const seen = new Set<string>();

  // Check all known carrier patterns
  const carrierNames = Object.keys(CARRIER_PATTERNS);

  for (const carrierName of carrierNames) {
    // Skip overly broad patterns in body text
    if (carrierName === "ALIEXPRESS_STANDARD") continue;

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

      // Filter: skip numbers matching common international phone patterns
      if (PHONE_PATTERNS.some((p) => p.test(trackingNumber))) continue;

      // Filter: skip if followed by phone-related context
      const after = text.substring(match.index + match[0].length, match.index + match[0].length + 30);
      if (PHONE_CONTEXT.test(after)) continue;

      seen.add(trackingNumber);
      results.push({
        trackingNumber,
        carrier: carrierName,
      });
    }
  }

  return results;
}
