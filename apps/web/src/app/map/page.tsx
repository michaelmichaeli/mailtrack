"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, Package, Navigation, Filter, Locate, Layers, ExternalLink, Info } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { PageTransition, FadeIn } from "@/components/ui/motion";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Card, CardContent } from "@/components/ui/card";

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((m) => m.CircleMarker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);

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
  if (CITY_COORDS[lower]) return CITY_COORDS[lower];
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(city) || city.includes(lower)) return coords;
  }
  return null;
}

const STATUS_COLORS: Record<string, string> = {
  ORDERED: "#94A3B8",
  PROCESSING: "#94A3B8",
  SHIPPED: "#3B82F6",
  IN_TRANSIT: "#6366F1",
  OUT_FOR_DELIVERY: "#8B5CF6",
  PICKED_UP: "#14B8A6",
  DELIVERED: "#10B981",
  EXCEPTION: "#F59E0B",
  RETURNED: "#EF4444",
};

const ACTIVE_STATUSES = ["IN_TRANSIT", "OUT_FOR_DELIVERY", "SHIPPED", "PROCESSING", "ORDERED", "PICKED_UP", "EXCEPTION"] as const;
const ALL_STATUSES = [...ACTIVE_STATUSES, "DELIVERED", "RETURNED"] as const;

interface PackageLocation {
  id: string;
  orderId: string;
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
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(ACTIVE_STATUSES));
  const [showLegend, setShowLegend] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
        () => setUserLocation([32.0853, 34.7818])
      );
    } else {
      setUserLocation([32.0853, 34.7818]);
    }

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

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    setMapReady(true);
    return () => { document.head.removeChild(link); };
  }, []);

  const allLocations = useMemo<PackageLocation[]>(() => {
    const result: PackageLocation[] = [];
    const seen = new Set<string>();

    packages.forEach((order) => {
      const pkg = order.package;
      if (!pkg) return;

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
        orderId: order.id,
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

  const filteredLocations = useMemo(
    () => allLocations.filter((loc) => activeFilters.has(loc.status)),
    [allLocations, activeFilters]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allLocations.forEach((loc) => {
      counts[loc.status] = (counts[loc.status] || 0) + 1;
    });
    return counts;
  }, [allLocations]);

  const toggleFilter = useCallback((status: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  const showAll = useCallback(() => setActiveFilters(new Set(ALL_STATUSES)), []);
  const showActive = useCallback(() => setActiveFilters(new Set(ACTIVE_STATUSES)), []);

  const center = userLocation || [32.0853, 34.7818];

  if (loading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="flex flex-col h-full">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 md:p-6 pb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("map.title")}</h1>
            <p className="text-sm text-muted-foreground/80 mt-0.5">{t("map.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground active:bg-muted/50 transition-colors"
            >
              <Info className="h-3.5 w-3.5" />
              {t("map.legend")}
            </button>
            <div className="hidden md:block">
              <NotificationBell />
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Stats bar */}
      <FadeIn delay={0.05}>
        <div className="flex items-center gap-3 px-4 md:px-6 pb-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <Layers className="h-3.5 w-3.5" />
            <span>{t("map.showing")} <strong className="text-foreground">{filteredLocations.length}</strong> / {allLocations.length}</span>
          </div>
          <div className="h-4 w-px bg-border shrink-0" />
          <button onClick={showActive} className="text-xs font-medium text-primary shrink-0 active:opacity-70">{t("map.activeOnly")}</button>
          <button onClick={showAll} className="text-xs font-medium text-muted-foreground shrink-0 active:opacity-70">{t("map.showAll")}</button>
        </div>
      </FadeIn>

      {/* Filter pills */}
      <FadeIn delay={0.08}>
        <div className="flex gap-1.5 px-4 md:px-6 pb-3 overflow-x-auto">
          {ALL_STATUSES.map((status) => {
            const count = statusCounts[status] || 0;
            const active = activeFilters.has(status);
            return (
              <button
                key={status}
                onClick={() => toggleFilter(status)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all shrink-0 border ${
                  active
                    ? "border-transparent text-white shadow-sm"
                    : "border-border text-muted-foreground bg-background"
                }`}
                style={active ? { backgroundColor: STATUS_COLORS[status] } : undefined}
              >
                <span>{t(`status.${status}` as any)}</span>
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                    active ? "bg-white/20" : "bg-muted"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </FadeIn>

      {/* Legend overlay */}
      {showLegend && (
        <div className="mx-4 md:mx-6 mb-3 rounded-lg border border-border bg-card p-3 text-xs space-y-1.5">
          <p className="font-semibold text-foreground text-sm mb-2">{t("map.legendTitle")}</p>
          <p className="text-muted-foreground">{t("map.legendDesc")}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {ALL_STATUSES.map((status) => (
              <div key={status} className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[status] }} />
                <span className="text-muted-foreground">{t(`status.${status}` as any)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <FadeIn delay={0.1}>
        <div className="flex-1 flex flex-col md:flex-row gap-3 px-4 md:px-6 pb-4">
          {/* Map */}
          <div className="rounded-xl border border-border overflow-hidden bg-card h-[50vh] md:h-auto md:flex-1 min-h-[400px] relative">
            {mapReady && filteredLocations.length > 0 ? (
              <MapContainer
                center={center as [number, number]}
                zoom={filteredLocations.length > 0 ? 4 : 10}
                className="h-full w-full"
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filteredLocations.map((loc) => (
                  <CircleMarker
                    key={loc.id}
                    center={loc.coords}
                    radius={8}
                    pathOptions={{
                      color: STATUS_COLORS[loc.status] || "#6366F1",
                      fillColor: STATUS_COLORS[loc.status] || "#6366F1",
                      fillOpacity: 0.8,
                      weight: 2,
                    }}
                    eventHandlers={{
                      click: () => setSelectedLocation(loc.id),
                    }}
                  >
                    <Popup>
                      <div className="text-sm space-y-2 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[loc.status] }} />
                          <span className="font-semibold">{t(`status.${loc.status}` as any)}</span>
                        </div>
                        <p className="font-medium">{loc.merchant || loc.carrier}</p>
                        <p className="text-xs text-gray-500">{loc.trackingNumber}</p>
                        <p className="text-xs flex items-center gap-1">
                          <Navigation className="h-3 w-3" />
                          {loc.location}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {t("map.lastSeen")}: {new Date(loc.timestamp).toLocaleDateString()}
                        </p>
                        <a
                          href={`/orders/${loc.orderId}`}
                          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 mt-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {t("map.viewPackage")}
                        </a>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            ) : mapReady ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 mb-4">
                  <MapPin className="h-7 w-7 text-primary/40" />
                </div>
                <p className="text-sm font-semibold text-foreground/70 mb-1">{t("map.noLocations")}</p>
                <p className="text-xs text-muted-foreground/60 max-w-[280px]">{t("map.noLocationsHint")}</p>
                {allLocations.length > 0 && filteredLocations.length === 0 && (
                  <button onClick={showAll} className="mt-3 text-xs font-medium text-primary active:opacity-70">
                    {t("map.showAll")}
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {/* Sidebar list */}
          <div className="w-full md:w-72 space-y-2 overflow-y-auto max-h-[300px] md:max-h-full">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("map.packageLocations")} ({filteredLocations.length})
              </p>
            </div>

            {filteredLocations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 mb-4">
                  <Package className="h-5 w-5 text-primary/40" />
                </div>
                <p className="text-sm font-semibold text-foreground/70">{t("map.noResults")}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{t("map.adjustFilters")}</p>
              </div>
            ) : (
              filteredLocations.map((loc) => (
                <Link
                  key={loc.id}
                  href={`/orders/${loc.orderId}`}
                  className={`block rounded-lg border p-3 active:bg-muted/30 transition-colors cursor-pointer ${
                    selectedLocation === loc.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className="h-3 w-3 rounded-full mt-1 shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[loc.status] || "#6366F1" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {loc.merchant || loc.carrier}
                        </p>
                        <ExternalLink className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Navigation className="h-3 w-3 shrink-0" />
                        <span className="truncate">{loc.location}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-medium" style={{ color: STATUS_COLORS[loc.status] }}>
                          {t(`status.${loc.status}` as any)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">·</span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {new Date(loc.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </FadeIn>
    </PageTransition>
  );
}
