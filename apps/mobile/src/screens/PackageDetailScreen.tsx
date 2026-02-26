import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

const API_BASE = "http://localhost:3001/api";

export function PackageDetailScreen({ route }: any) {
  const { id } = route.params;

  const { data: pkg, refetch } = useQuery({
    queryKey: ["package", id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/packages/${id}`, {
        headers: { Authorization: `Bearer TODO_TOKEN` },
      });
      return res.json();
    },
  });

  const handleRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await fetch(`${API_BASE}/packages/${id}/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer TODO_TOKEN` },
    });
    refetch();
  };

  if (!pkg) return null;

  const statusColors: Record<string, string> = {
    DELIVERED: "#10B981",
    IN_TRANSIT: "#3B82F6",
    OUT_FOR_DELIVERY: "#6366F1",
    EXCEPTION: "#F97316",
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.merchant}>{pkg.order?.merchant}</Text>
          <View style={[styles.statusBadge, { backgroundColor: (statusColors[pkg.status] ?? "#9CA3AF") + "20" }]}>
            <Text style={[styles.statusText, { color: statusColors[pkg.status] ?? "#9CA3AF" }]}>
              {pkg.status.replace("_", " ")}
            </Text>
          </View>
        </View>

        <Text style={styles.tracking}>{pkg.carrier} · {pkg.trackingNumber}</Text>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          {["ORDERED", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"].map((step, i) => {
            const steps = ["ORDERED", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];
            const currentIndex = steps.indexOf(pkg.status);
            return (
              <View
                key={step}
                style={[styles.progressStep, { backgroundColor: i <= currentIndex ? "#3B82F6" : "#E5E5E5" }]}
              />
            );
          })}
        </View>

        {/* Details */}
        <View style={styles.details}>
          {pkg.lastLocation && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>📍 {pkg.lastLocation}</Text>
            </View>
          )}
          {pkg.estimatedDelivery && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estimated delivery</Text>
              <Text style={styles.detailValue}>{new Date(pkg.estimatedDelivery).toLocaleDateString()}</Text>
            </View>
          )}
          {pkg.order?.totalAmount && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Order total</Text>
              <Text style={styles.detailValue}>{pkg.order.currency} {pkg.order.totalAmount}</Text>
            </View>
          )}
        </View>

        {/* Refresh button */}
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Text style={styles.refreshText}>🔄 Refresh tracking</Text>
        </TouchableOpacity>

        {/* Timeline */}
        <Text style={styles.sectionTitle}>Tracking History</Text>
        {pkg.events?.map((event: any, index: number) => (
          <View key={event.id} style={styles.timelineItem}>
            <View style={styles.timelineDot}>
              <View style={[styles.dot, { backgroundColor: index === 0 ? "#3B82F6" : "#E5E5E5" }]} />
              {index < pkg.events.length - 1 && <View style={styles.line} />}
            </View>
            <View style={styles.timelineContent}>
              <Text style={[styles.eventDescription, index === 0 && { fontWeight: "600" }]}>
                {event.description}
              </Text>
              <Text style={styles.eventMeta}>
                {new Date(event.timestamp).toLocaleString()}
                {event.location ? ` · ${event.location}` : ""}
              </Text>
            </View>
          </View>
        ))}

        {(!pkg.events || pkg.events.length === 0) && (
          <Text style={styles.noEvents}>No tracking events yet</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  merchant: { fontSize: 22, fontWeight: "bold" },
  statusBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  statusText: { fontSize: 12, fontWeight: "600" },
  tracking: { fontSize: 14, color: "#737373", marginBottom: 16 },
  progressContainer: { flexDirection: "row", gap: 4, marginBottom: 24 },
  progressStep: { flex: 1, height: 6, borderRadius: 3 },
  details: { backgroundColor: "#F5F5F5", borderRadius: 12, padding: 16, marginBottom: 16 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  detailLabel: { fontSize: 13, color: "#737373" },
  detailValue: { fontSize: 13, fontWeight: "500" },
  refreshButton: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginBottom: 24,
  },
  refreshText: { fontSize: 14, fontWeight: "500" },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  timelineItem: { flexDirection: "row", marginBottom: 0 },
  timelineDot: { alignItems: "center", width: 24, marginRight: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  line: { width: 2, flex: 1, backgroundColor: "#E5E5E5", marginVertical: 4 },
  timelineContent: { flex: 1, paddingBottom: 20 },
  eventDescription: { fontSize: 14, marginBottom: 2 },
  eventMeta: { fontSize: 12, color: "#737373" },
  noEvents: { textAlign: "center", color: "#9CA3AF", paddingVertical: 40 },
});
