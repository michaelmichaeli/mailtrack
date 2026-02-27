/**
 * Google Places service for looking up pickup point details (hours, address, phone).
 * Uses the Google Places API to enrich pickup location data.
 */

const GOOGLE_PLACES_API_KEY = "AIzaSyAIIw2PORsjPaxKz1j3qMwikghZMX36U6w";

interface PlaceDetails {
  name: string;
  address: string;
  hours: string | null; // Formatted weekday text
  weekdayText: string[] | null; // Full weekday schedule
  openNow: boolean | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
}

// Cache to avoid repeated API calls for same location
const placeCache = new Map<string, PlaceDetails | null>();

/**
 * Look up a pickup point's details (hours, address, etc.) via Google Places API.
 * @param locationName - The name/description of the pickup point (e.g. "מרכז מסירה שר המשקאות יפו, תל אביב")
 */
export async function lookupPickupPointDetails(locationName: string): Promise<PlaceDetails | null> {
  if (!locationName || locationName.length < 3) return null;

  // Check cache
  const cacheKey = locationName.trim().toLowerCase();
  if (placeCache.has(cacheKey)) return placeCache.get(cacheKey)!;

  try {
    // Step 1: Text search to find the place
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(locationName)}&key=${GOOGLE_PLACES_API_KEY}`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
    const searchData: any = await searchRes.json();

    if (!searchData.results?.[0]?.place_id) {
      console.log(`[places] No results for: ${locationName}`);
      placeCache.set(cacheKey, null);
      return null;
    }

    const placeId = searchData.results[0].place_id;
    const basicResult = searchData.results[0];

    // Step 2: Get details with opening hours
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,opening_hours,formatted_phone_number,geometry&key=${GOOGLE_PLACES_API_KEY}`;
    const detailsRes = await fetch(detailsUrl, { signal: AbortSignal.timeout(10000) });
    const detailsData: any = await detailsRes.json();

    const result = detailsData.result || {};
    const hours = result.opening_hours;

    const details: PlaceDetails = {
      name: result.name || basicResult.name || locationName,
      address: result.formatted_address || basicResult.formatted_address || locationName,
      hours: hours?.weekday_text ? hours.weekday_text.join("\n") : null,
      weekdayText: hours?.weekday_text || null,
      openNow: hours?.open_now ?? null,
      phone: result.formatted_phone_number || null,
      lat: result.geometry?.location?.lat || basicResult.geometry?.location?.lat || null,
      lng: result.geometry?.location?.lng || basicResult.geometry?.location?.lng || null,
    };

    console.log(`[places] Found "${details.name}" at ${details.address} (${details.hours ? 'has hours' : 'no hours'})`);
    placeCache.set(cacheKey, details);
    return details;
  } catch (error: any) {
    console.error(`[places] Error looking up "${locationName}":`, error?.message);
    placeCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Enrich a pickup location object with Google Places data (hours, exact address, phone).
 */
export async function enrichPickupLocation(pickup: any): Promise<any> {
  if (!pickup) return pickup;

  const searchName = pickup.name || pickup.address;
  if (!searchName) return pickup;

  const details = await lookupPickupPointDetails(searchName);
  if (!details) return pickup;

  return {
    ...pickup,
    name: details.name || pickup.name,
    address: details.address || pickup.address,
    hours: details.hours || pickup.hours || null,
    weekdayText: details.weekdayText || null,
    openNow: details.openNow,
    phone: details.phone || null,
    lat: details.lat,
    lng: details.lng,
  };
}
