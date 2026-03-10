/**
 * parcelsapp.com tracking service.
 * Uses their public REST API for package tracking across 1000+ carriers.
 * Requires API key set via PARCELSAPP_API_KEY env var.
 */
import { PackageStatus, Carrier } from "@mailtrack/shared";
import type { CarrierTrackingResult, CarrierTrackingEvent } from "@mailtrack/shared";

const PARCELSAPP_API = "https://parcelsapp.com/api/v3/shipments/tracking";

// parcelsapp status → our status
function mapStatus(status: string): PackageStatus {
  const s = (status || "").toLowerCase();
  if (s.includes("delivered")) return PackageStatus.DELIVERED;
  if (s.includes("pickup") || s.includes("available_for_pickup")) return PackageStatus.OUT_FOR_DELIVERY;
  if (s.includes("out_for_delivery") || s.includes("outfordelivery")) return PackageStatus.OUT_FOR_DELIVERY;
  if (s.includes("in_transit") || s.includes("transit")) return PackageStatus.IN_TRANSIT;
  if (s.includes("info_received") || s.includes("inforeceived")) return PackageStatus.PROCESSING;
  if (s.includes("exception") || s.includes("failed") || s.includes("expired")) return PackageStatus.EXCEPTION;
  if (s.includes("return")) return PackageStatus.RETURNED;
  return PackageStatus.IN_TRANSIT;
}

// Map our Carrier enum to parcelsapp carrier slug
function getCarrierSlug(carrier: Carrier): string | undefined {
  const map: Record<string, string> = {
    ISRAEL_POST: "israel-post",
    CAINIAO: "cainiao",
    ALIEXPRESS: "yanwen",
    DHL: "dhl",
    FEDEX: "fedex",
    UPS: "ups",
    USPS: "usps",
    TNT: "tnt",
    ARAMEX: "aramex",
    "4PX": "4px",
    YANWEN: "yanwen",
  };
  return map[carrier] ?? undefined;
}

/**
 * Track a single package via parcelsapp.com API.
 * Returns null if API key is not configured or tracking fails.
 */
export async function trackParcelsApp(
  trackingNumber: string,
  carrier: Carrier,
): Promise<CarrierTrackingResult | null> {
  const apiKey = process.env.PARCELSAPP_API_KEY;
  if (!apiKey) {
    console.log("[parcelsapp] No API key configured (PARCELSAPP_API_KEY)");
    return null;
  }

  try {
    const body: any = {
      shipments: [{ trackingId: trackingNumber }],
      language: "en",
      apiKey,
    };

    const carrierSlug = getCarrierSlug(carrier);
    if (carrierSlug) {
      body.shipments[0].destinationCountry = undefined;
    }

    const response = await fetch(PARCELSAPP_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[parcelsapp] HTTP ${response.status} for ${trackingNumber}`);
      return null;
    }

    const data: any = await response.json();

    // parcelsapp returns a UUID and you need to poll — for the first request it might return "pending"
    if (data?.uuid && !data?.shipments) {
      // Poll for results
      const pollUrl = `https://parcelsapp.com/api/v3/shipments/tracking?apiKey=${apiKey}&uuid=${data.uuid}`;
      let attempts = 0;
      while (attempts < 5) {
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await fetch(pollUrl, { signal: AbortSignal.timeout(10000) });
        if (!pollRes.ok) break;
        const pollData: any = await pollRes.json();
        if (pollData?.shipments?.length > 0 && pollData.shipments[0].status !== "pending") {
          return parseShipment(pollData.shipments[0], trackingNumber, carrier);
        }
        if (pollData?.done) break;
        attempts++;
      }
      return null;
    }

    if (!data?.shipments?.length) {
      console.log(`[parcelsapp] No shipment data for ${trackingNumber}`);
      return null;
    }

    return parseShipment(data.shipments[0], trackingNumber, carrier);
  } catch (error: any) {
    console.error(`[parcelsapp] Error tracking ${trackingNumber}:`, error?.message);
    return null;
  }
}

function parseShipment(
  shipment: any,
  trackingNumber: string,
  carrier: Carrier,
): CarrierTrackingResult | null {
  if (!shipment || shipment.status === "not_found") return null;

  const states: any[] = shipment.states ?? [];
  if (states.length === 0) return null;

  const events: CarrierTrackingEvent[] = states.map((s: any) => ({
    timestamp: s.date || new Date().toISOString(),
    location: s.location || null,
    status: mapStatus(s.status || shipment.status || ""),
    description: s.status || s.description || "",
  }));

  const latestStatus = mapStatus(shipment.status || states[0]?.status || "");
  const lastLocation = states.find((s: any) => s.location)?.location || null;

  return {
    trackingNumber,
    carrier,
    status: latestStatus,
    estimatedDelivery: shipment.estimatedDeliveryDate || null,
    lastLocation,
    events,
    originCountry: shipment.origin || null,
    destCountry: shipment.destination || null,
  };
}
