import { CARRIER_PATTERNS } from "@mailtrack/shared";

/**
 * Auto-detect carrier from tracking number format.
 * Dynamically checks all patterns in CARRIER_PATTERNS — adding a new
 * carrier is just adding an entry to the patterns map, no code changes needed.
 */
export function detectCarrier(trackingNumber: string): string {
  const n = trackingNumber.trim().toUpperCase();

  for (const [carrier, pattern] of Object.entries(CARRIER_PATTERNS)) {
    if (pattern.test(n)) return carrier;
  }

  return "UNKNOWN";
}

// Words that precede phone numbers — used to filter false positives
const PHONE_CONTEXT = /(?:phone|tel|mobile|fax|call|whatsapp|\(\+?\d{1,3}\))\s*/i;

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

      seen.add(trackingNumber);
      results.push({
        trackingNumber,
        carrier: carrierName,
      });
    }
  }

  return results;
}
