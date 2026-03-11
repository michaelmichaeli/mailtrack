"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { MapPin, Package, Navigation } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// Lazy-load map to avoid SSR issues with Leaflet
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);

// Known city coordinates for geocoding location strings
const CITY_COORDS: Record<string, [number, number]> = {
  "tel aviv": [32.0853, 34.7818],
  "jerusalem": [31.7683, 35.2137],
  "haifa": [32.7940, 34.9896],
  "beer sheva": [31.2530, 34.7915],
  "rishon lezion": [31.9730, 34.7925],
  "petah tikva": [32.0841, 34.8878],
  "ashdod": [31.8044, 34.6553],
  "netanya": [32.3215, 34.8532],
  "holon": [32.0158, 34.7797],
  "bnei brak": [32.0834, 34.8344],
  "ramat gan": [32.0700, 34.8240],
  "rehovot": [31.8928, 34.8113],
  "ashkelon": [31.6688, 34.5743],
  "bat yam": [32.0171, 34.7502],
  "herzliya": [32.1629, 34.8446],
  "kfar saba": [32.1751, 34.9065],
  "modiin": [31.8969, 35.0101],
  "nazareth": [32.6996, 35.3035],
  "lod": [31.9514, 34.8953],
  "ramla": [31.9275, 34.8625],
  "israel": [31.5, 34.75],
  "new york": [40.7128, -74.0060],
  "los angeles": [34.0522, -118.2437],
  "chicago": [41.8781, -87.6298],
  "london": [51.5074, -0.1278],
  "shanghai": [31.2304, 121.4737],
  "shenzhen": [22.5431, 114.0579],
  "guangzhou": [23.1291, 113.2644],
  "beijing": [39.9042, 116.4074],
  "hong kong": [22.3193, 114.1694],
  "dubai": [25.2048, 55.2708],
  "singapore": [1.3521, 103.8198],
  "tokyo": [35.6762, 139.6503],
  "paris": [48.8566, 2.3522],
  "berlin": [52.5200, 13.4050],
  "moscow": [55.7558, 37.6173],
  "istanbul": [41.0082, 28.9784],
  "miami": [25.7617, -80.1918],
  "san francisco": [37.7749, -122.4194],
  "amsterdam": [52.3676, 4.9041],
  "china": [35.8617, 104.1954],
  "usa": [39.8283, -98.5795],
  "united states": [39.8283, -98.5795],
  "germany": [51.1657, 10.4515],
  "france": [46.2276, 2.2137],
  "uk": [55.3781, -3.4360],
  "united kingdom": [55.3781, -3.4360],
  "turkey": [38.9637, 35.2433],
  "india": [20.5937, 78.9629],
  "brazil": [14.2350, -51.9253],
  "australia": [-25.2744, 133.7751],
  "japan": [36.2048, 138.2529],
  "south korea": [35.9078, 127.7669],
  "korea": [35.9078, 127.7669],
};

function geocodeLocation(location: string): [number, number] | null {
  const lower = location.toLowerCase().trim();
  // Direct match
  if (CITY_COORDS[lower]) return CITY_COORDS[lower];
  // Partial match
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(city) || city.includes(lower)) return coords;
  }
  return null;
}

interface PackageLocation {
  id: string;
  trackingNumber: string;
  carrier: string;
  status: string;
  location: string;
  coords: [number, number];
  timestamp: string;
  merchant?: string;
}

export default function MapPage() {
  const { t } = useI18n();
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    // Get user location
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
        () => setUserLocation([32.0853, 34.7818]) // Default to Tel Aviv
      );
    } else {
      setUserLocation([32.0853, 34.7818]);
    }

    // Fetch packages
    api.getDashboard("year")
      .then((data: any) => {
        const all = [
          ...(data.arrivingToday || []),
          ...(data.inTransit || []),
          ...(data.processing || []),
          ...(data.delivered || []),
          ...(data.exceptions || []),
        ];
        setPackages(all);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Load leaflet CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    setMapReady(true);

    return () => { document.head.removeChild(link); };
  }, []);

  const locations = useMemo<PackageLocation[]>(() => {
    const result: PackageLocation[] = [];
    const seen = new Set<string>();

    packages.forEach((order) => {
      const pkg = order.package;
      if (!pkg) return;

      // Get last known location from events or package
      const lastEvent = pkg.events?.sort((a: any, b: any) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )?.[0];

      const location = lastEvent?.location || pkg.lastLocation;
      if (!location) return;

      const coords = geocodeLocation(location);
      if (!coords) return;

      const key = `${pkg.trackingNumber}-${location}`;
      if (seen.has(key)) return;
      seen.add(key);

      result.push({
        id: pkg.id,
        trackingNumber: pkg.trackingNumber,
        carrier: pkg.carrier,
        status: pkg.status,
        location,
        coords: [coords[0] + (Math.random() - 0.5) * 0.01, coords[1] + (Math.random() - 0.5) * 0.01],
        timestamp: lastEvent?.timestamp || pkg.updatedAt,
        merchant: order.merchant,
      });
    });

    return result;
  }, [packages]);

  const center = userLocation || [32.0853, 34.7818];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-1rem)] md:h-screen">
      <div className="p-4 md:p-6 pb-2">
        <h1 className="text-2xl font-bold text-foreground">{t("map.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("map.subtitle")}</p>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 px-4 md:px-6 pb-4">
        {/* Map */}
        <div className="flex-1 rounded-xl border border-border overflow-hidden bg-card min-h-[400px]">
          {mapReady && (
            <MapContainer
              center={center as [number, number]}
              zoom={locations.length > 0 ? 4 : 10}
              className="h-full w-full"
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {locations.map((loc) => (
                <Marker key={loc.id} position={loc.coords}>
                  <Popup>
                    <div className="text-sm space-y-1">
                      <p className="font-semibold">{loc.merchant || loc.carrier}</p>
                      <p className="text-xs text-gray-500">{t("map.tracking")}: {loc.trackingNumber}</p>
                      <p className="text-xs">{loc.location}</p>
                      <p className="text-xs text-gray-400">
                        {t("map.lastSeen")}: {new Date(loc.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>

        {/* Location list */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full md:w-72 space-y-2 overflow-y-auto max-h-[300px] md:max-h-full"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            {t("map.packageLocations")} ({locations.length})
          </p>

          {locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MapPin className="h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">{t("map.noLocations")}</p>
            </div>
          ) : (
            locations.map((loc) => (
              <div
                key={loc.id}
                className="rounded-lg border border-border bg-card p-3 hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-2">
                  <Package className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {loc.merchant || loc.carrier}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Navigation className="h-3 w-3" />
                      {loc.location}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {t(`status.${loc.status}` as any)} · {new Date(loc.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </motion.div>
      </div>
    </div>
  );
}
