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
  DHL: /\b(\d{10}|\d{20}|[A-Z]{3}\d{7,20})\b/i,
  DPD: /\b\d{14}\b/,
  ROYAL_MAIL: /\b[A-Z]{2}\d{9}GB\b/i,
  CAINIAO: /\b(LP|CAINIAO)\d{12,20}\b/i,
  YANWEN: /\bY[A-Z]\d{9}[A-Z]{2}\b/i,
};

// Email search queries for known merchants
export const GMAIL_SEARCH_QUERY =
  'from:(amazon OR aliexpress OR ebay OR etsy OR shein OR temu OR walmart OR shopify) subject:(order OR shipping OR tracking OR delivered OR confirmation OR dispatched)';

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
