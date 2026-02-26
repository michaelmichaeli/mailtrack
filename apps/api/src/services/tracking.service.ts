import type { CarrierTrackingResult, CarrierTrackingEvent } from "@mailtrack/shared";
import { PackageStatus, Carrier } from "@mailtrack/shared";

const API_BASE = "https://api.17track.net/track/v2.2";

// 17track status mapping to our unified enum
const STATUS_MAP: Record<number, PackageStatus> = {
  0: PackageStatus.ORDERED,       // Not found
  10: PackageStatus.IN_TRANSIT,    // In transit
  20: PackageStatus.EXCEPTION,     // Expired
  30: PackageStatus.PROCESSING,    // Ready to be picked up
  35: PackageStatus.EXCEPTION,     // Undelivered
  40: PackageStatus.DELIVERED,     // Delivered
  50: PackageStatus.EXCEPTION,     // Alert
};

// 17track carrier code mapping
const CARRIER_CODE_MAP: Record<string, number> = {
  UPS: 100002,
  FEDEX: 100003,
  USPS: 100001,
  DHL: 100004,
  DPD: 190012,
  ROYAL_MAIL: 190001,
  CAINIAO: 190271,
  YANWEN: 190011,
};

/**
 * Track a package using the 17track API.
 */
export async function trackPackage(
  trackingNumber: string,
  carrier: Carrier
): Promise<CarrierTrackingResult | null> {
  const apiKey = process.env.TRACKING_API_KEY;

  if (!apiKey || apiKey === "your-17track-api-key") {
    // Return mock data in development
    return getMockTrackingResult(trackingNumber, carrier);
  }

  try {
    const carrierCode = CARRIER_CODE_MAP[carrier];
    const body = [
      {
        number: trackingNumber,
        ...(carrierCode ? { carrier: carrierCode } : {}),
      },
    ];

    const response = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "17token": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`17track API error: ${response.status}`);
    }

    // Wait a moment for tracking to be processed, then fetch results
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const trackResponse = await fetch(`${API_BASE}/gettrackinfo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "17token": apiKey,
      },
      body: JSON.stringify([{ number: trackingNumber }]),
    });

    if (!trackResponse.ok) {
      throw new Error(`17track API error: ${trackResponse.status}`);
    }

    const data: Record<string, any> = await trackResponse.json() as Record<string, any>;
    const accepted = data?.data?.accepted?.[0];

    if (!accepted) return null;

    const trackInfo = accepted.track;
    const events: CarrierTrackingEvent[] = (trackInfo?.z ?? []).map((e: any) => ({
      timestamp: e.a ?? new Date().toISOString(),
      location: e.c ?? null,
      status: STATUS_MAP[trackInfo.e] ?? PackageStatus.IN_TRANSIT,
      description: e.z ?? "",
    }));

    return {
      trackingNumber,
      carrier,
      status: STATUS_MAP[trackInfo?.e] ?? PackageStatus.IN_TRANSIT,
      estimatedDelivery: trackInfo?.d ?? null,
      lastLocation: events[0]?.location ?? null,
      events,
    };
  } catch (error) {
    console.error("Tracking API error:", error);
    return null;
  }
}

/**
 * Mock tracking result for development/testing.
 */
function getMockTrackingResult(trackingNumber: string, carrier: Carrier): CarrierTrackingResult {
  const now = new Date();
  const events: CarrierTrackingEvent[] = [
    {
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      location: "Distribution Center",
      status: PackageStatus.IN_TRANSIT,
      description: "Package in transit to destination",
    },
    {
      timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      location: "Origin Facility",
      status: PackageStatus.SHIPPED,
      description: "Package picked up by carrier",
    },
    {
      timestamp: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
      location: "Seller",
      status: PackageStatus.PROCESSING,
      description: "Shipping label created",
    },
  ];

  return {
    trackingNumber,
    carrier,
    status: PackageStatus.IN_TRANSIT,
    estimatedDelivery: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastLocation: "Distribution Center",
    events,
  };
}
