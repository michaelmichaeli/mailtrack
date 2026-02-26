export const PACKAGE_STATUS_LABELS: Record<string, string> = {
  ORDERED: "Ordered",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  EXCEPTION: "Exception",
  RETURNED: "Returned",
};

export const PACKAGE_STATUS_COLORS: Record<string, string> = {
  ORDERED: "gray",
  PROCESSING: "gray",
  SHIPPED: "blue",
  IN_TRANSIT: "blue",
  OUT_FOR_DELIVERY: "indigo",
  DELIVERED: "green",
  EXCEPTION: "orange",
  RETURNED: "red",
};

export const PACKAGE_STATUS_ORDER = [
  "ORDERED",
  "PROCESSING",
  "SHIPPED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

// Carrier tracking number regex patterns
export const CARRIER_PATTERNS: Record<string, RegExp> = {
  UPS: /\b1Z[A-Z0-9]{16}\b/i,
  FEDEX: /\b(\d{12}|\d{15}|\d{20})\b/,
  USPS: /\b(9[2-5]\d{20,26}|[A-Z]{2}\d{9}US)\b/i,
  DHL: /\b(\d{10,11}|[A-Z]{3}\d{7,20}|JJD\d{18})\b/i,
  DPD: /\b\d{14}\b/,
  ROYAL_MAIL: /\b[A-Z]{2}\d{9}GB\b/i,
  CAINIAO: /\b(LP|CAINIAO)\d{12,20}\b/i,
  YANWEN: /\bY[A-Z]\d{9}[A-Z]{2}\b/i,
  ALIEXPRESS_STANDARD: /\b[A-Z]{2}\d{9,13}[A-Z]?\b/,
  ISRAEL_POST: /\b[A-Z]{2}\d{9}IL\b/i,
  FOUR_PX: /\b(4PX|FPXE)\d{10,16}\b/i,
  SUNYOU: /\bSYUS\d{10,16}\b/i,
  YUNEXPRESS: /\bYT\d{16}\b/i,
  JT_EXPRESS: /\bJT\d{13,16}\b/i,
  ARAMEX: /\b\d{10}\b/,
  POSTNL: /\b(3S|LS|NL)\d{10,13}(NL)?\b/i,
  LA_POSTE: /\b[A-Z]{2}\d{9}FR\b/i,
  CANADA_POST: /\b\d{16}\b/,
  TNT: /\b\d{9}\b/,
  GLS: /\b\d{11,12}\b/,
};

// Email search queries for known merchants
export const GMAIL_SEARCH_QUERY =
  'from:(amazon OR aliexpress OR ebay OR etsy OR shein OR temu OR walmart OR shopify OR iherb OR "zara.com" OR asos OR "hm.com" OR dhl OR fedex OR ups OR "israel post" OR "דואר ישראל" OR cainiao OR yanwen OR 4px OR "parcel home" OR "next.co" OR "tiktok shop") subject:(order OR shipping OR tracking OR delivered OR confirmation OR dispatched OR shipment OR "out for delivery" OR "on its way" OR "has been shipped" OR parcel OR pickup OR "pick up")';

export const OUTLOOK_SEARCH_QUERY =
  '(from:amazon OR from:aliexpress OR from:ebay OR from:etsy) AND (subject:order OR subject:shipping OR subject:tracking)';

// API rate limits
export const RATE_LIMITS = {
  general: { max: 100, timeWindow: "1 minute" },
  auth: { max: 10, timeWindow: "1 minute" },
  emailSync: { max: 5, timeWindow: "1 minute" },
} as const;

// Tracking poll intervals (in milliseconds)
export const POLL_INTERVALS = {
  PRE_SHIPMENT: 12 * 60 * 60 * 1000, // 12 hours
  IN_TRANSIT: 4 * 60 * 60 * 1000,     // 4 hours
  OUT_FOR_DELIVERY: 30 * 60 * 1000,   // 30 minutes
  DELIVERED_GRACE: 7 * 24 * 60 * 60 * 1000, // 7 days after delivery, stop polling
} as const;

// JWT config
export const JWT_CONFIG = {
  accessTokenExpiry: "15m",
  refreshTokenExpiry: "30d",
  issuer: "mailtrack",
} as const;
