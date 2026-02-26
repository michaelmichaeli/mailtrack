import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";

const API_BASE = "http://localhost:3001/api";

export function PackagesScreen({ navigation }: any) {
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["packages", search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "20" });
      if (search) params.set("query", search);
      const res = await fetch(`${API_BASE}/packages?${params}`, {
        headers: { Authorization: `Bearer TODO_TOKEN` },
      });
      return res.json();
    },
  });

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.packageCard}
      onPress={() => navigation.navigate("PackageDetail", { id: item.id })}
    >
      <View style={styles.row}>
        <Text style={styles.merchant}>{item.order?.merchant}</Text>
        <Text style={[styles.status, { color: getStatusColor(item.status) }]}>
          {item.status.replace("_", " ")}
        </Text>
      </View>
      <Text style={styles.tracking}>{item.carrier} · {item.trackingNumber}</Text>
      {item.latestEvent && (
        <Text style={styles.event} numberOfLines={1}>
          {item.latestEvent.description}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search packages..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#9CA3AF"
      />
      <FlatList
        data={data?.items ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No packages found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DELIVERED: "#10B981",
    IN_TRANSIT: "#3B82F6",
    OUT_FOR_DELIVERY: "#6366F1",
    EXCEPTION: "#F97316",
    RETURNED: "#EF4444",
  };
  return colors[status] ?? "#9CA3AF";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  searchInput: {
    margin: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F5F5F5",
    fontSize: 15,
  },
  list: { paddingHorizontal: 16 },
  packageCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  merchant: { fontSize: 15, fontWeight: "600" },
  status: { fontSize: 12, fontWeight: "600" },
  tracking: { fontSize: 12, color: "#737373" },
  event: { fontSize: 12, color: "#737373", marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 16, color: "#9CA3AF" },
});
