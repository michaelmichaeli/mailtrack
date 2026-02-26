import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { PackageStatus } from "@mailtrack/shared";
import * as Haptics from "expo-haptics";

const API_BASE = "http://localhost:3001/api";

export function DashboardScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/dashboard`, {
        headers: { Authorization: `Bearer TODO_TOKEN` },
      });
      return res.json();
    },
  });

  const onRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    refetch();
  };

  const stats = data?.stats;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Track all your packages</Text>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard label="Arriving today" value={stats?.arrivingToday ?? 0} color="#6366F1" />
          <StatCard label="In transit" value={stats?.inTransit ?? 0} color="#3B82F6" />
          <StatCard label="Processing" value={stats?.processing ?? 0} color="#9CA3AF" />
          <StatCard label="Delivered" value={stats?.delivered ?? 0} color="#10B981" />
        </View>

        {/* Package lists */}
        {data?.inTransit?.map((pkg: any) => (
          <PackageListItem key={pkg.id} pkg={pkg} />
        ))}
        {data?.processing?.map((pkg: any) => (
          <PackageListItem key={pkg.id} pkg={pkg} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PackageListItem({ pkg }: { pkg: any }) {
  const statusColors: Record<string, string> = {
    IN_TRANSIT: "#3B82F6",
    DELIVERED: "#10B981",
    EXCEPTION: "#F97316",
    OUT_FOR_DELIVERY: "#6366F1",
  };

  return (
    <TouchableOpacity style={styles.packageCard}>
      <View style={styles.packageHeader}>
        <Text style={styles.merchantName}>{pkg.order?.merchant}</Text>
        <View style={[styles.statusBadge, { backgroundColor: (statusColors[pkg.status] ?? "#9CA3AF") + "20" }]}>
          <Text style={[styles.statusText, { color: statusColors[pkg.status] ?? "#9CA3AF" }]}>
            {pkg.status.replace("_", " ")}
          </Text>
        </View>
      </View>
      <Text style={styles.trackingNumber}>{pkg.carrier} · {pkg.trackingNumber}</Text>
      {pkg.lastLocation && <Text style={styles.location}>📍 {pkg.lastLocation}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContent: { padding: 16 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#737373", marginBottom: 20 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
  },
  statValue: { fontSize: 24, fontWeight: "bold" },
  statLabel: { fontSize: 12, color: "#737373", marginTop: 2 },
  packageCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  packageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  merchantName: { fontSize: 15, fontWeight: "600" },
  statusBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: "600" },
  trackingNumber: { fontSize: 12, color: "#737373", marginBottom: 4 },
  location: { fontSize: 12, color: "#737373" },
});
