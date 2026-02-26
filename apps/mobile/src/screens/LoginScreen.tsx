import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function LoginScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>📦</Text>
          <Text style={styles.logoText}>MailTrack</Text>
          <Text style={styles.subtitle}>Track all your packages in one place</Text>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.googleButton}>
            <Text style={styles.googleText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.appleButton}>
            <Text style={styles.appleText}>Continue with Apple</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.terms}>
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1, justifyContent: "center", padding: 24 },
  logoContainer: { alignItems: "center", marginBottom: 48 },
  logoIcon: { fontSize: 56, marginBottom: 12 },
  logoText: { fontSize: 32, fontWeight: "bold" },
  subtitle: { fontSize: 16, color: "#737373", marginTop: 8 },
  buttons: { gap: 12 },
  googleButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  googleText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  appleButton: {
    backgroundColor: "#000",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  appleText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  terms: { textAlign: "center", fontSize: 12, color: "#9CA3AF", marginTop: 24 },
});
