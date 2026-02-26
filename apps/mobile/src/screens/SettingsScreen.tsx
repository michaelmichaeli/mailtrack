import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";

const API_BASE = "http://localhost:3001/api";

export function SettingsScreen() {
  const queryClient = useQueryClient();

  const { data: accounts } = useQuery({
    queryKey: ["connected-accounts"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/settings/connected-accounts`, {
        headers: { Authorization: `Bearer TODO_TOKEN` },
      });
      return res.json();
    },
  });

  const { data: notifPrefs } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/settings/notifications`, {
        headers: { Authorization: `Bearer TODO_TOKEN` },
      });
      return res.json();
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        {/* Connected Emails */}
        <Text style={styles.sectionTitle}>Connected Emails</Text>
        <View style={styles.card}>
          {accounts?.emails?.map((email: any) => (
            <View key={email.id} style={styles.accountRow}>
              <View>
                <Text style={styles.accountName}>{email.email}</Text>
                <Text style={styles.accountMeta}>{email.provider}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.connectButton}>
            <Text style={styles.connectText}>+ Connect Gmail</Text>
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Push notifications</Text>
              <Text style={styles.settingDescription}>Get notified on status changes</Text>
            </View>
            <Switch
              value={notifPrefs?.pushEnabled ?? true}
              onValueChange={(value) => {
                // TODO: Update preferences
              }}
              trackColor={{ false: "#E5E5E5", true: "#3B82F6" }}
            />
          </View>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Email notifications</Text>
              <Text style={styles.settingDescription}>Receive email digests</Text>
            </View>
            <Switch
              value={notifPrefs?.emailEnabled ?? false}
              onValueChange={(value) => {
                // TODO: Update preferences
              }}
              trackColor={{ false: "#E5E5E5", true: "#3B82F6" }}
            />
          </View>
        </View>

        {/* Data & Privacy */}
        <Text style={styles.sectionTitle}>Data & Privacy</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuText}>Export all data</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={[styles.menuText, { color: "#EF4444" }]}>Delete account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8, marginTop: 16 },
  card: { backgroundColor: "#F5F5F5", borderRadius: 12, overflow: "hidden" },
  accountRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#E5E5E5" },
  accountName: { fontSize: 14, fontWeight: "500" },
  accountMeta: { fontSize: 12, color: "#737373", marginTop: 2 },
  connectButton: { padding: 16, alignItems: "center" },
  connectText: { fontSize: 14, color: "#3B82F6", fontWeight: "500" },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  settingLabel: { fontSize: 14, fontWeight: "500" },
  settingDescription: { fontSize: 12, color: "#737373", marginTop: 2 },
  menuItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#E5E5E5" },
  menuText: { fontSize: 14, fontWeight: "500" },
});
