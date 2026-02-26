const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002/api";

interface FetchOptions extends RequestInit {
  token?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private tokenLoaded = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private loadToken(): string | null {
    if (!this.tokenLoaded && typeof window !== "undefined") {
      this.token = localStorage.getItem("mailtrack_token");
      this.tokenLoaded = true;
    }
    return this.token;
  }

  setToken(token: string | null) {
    this.token = token;
    this.tokenLoaded = true;
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("mailtrack_token", token);
      } else {
        localStorage.removeItem("mailtrack_token");
      }
    }
  }

  getToken() {
    return this.loadToken();
  }

  private async request<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options;
    const authToken = token ?? this.loadToken();

    const headers: Record<string, string> = {
      ...((fetchOptions.headers as Record<string, string>) ?? {}),
    };

    // Only set Content-Type for requests that have a body
    if (fetchOptions.body) {
      headers["Content-Type"] = "application/json";
    }

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...fetchOptions,
      headers,
      credentials: "include",
    });

    if (response.status === 401) {
      // Try to refresh token
      try {
        const refreshResult = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (refreshResult.ok) {
          const data = await refreshResult.json();
          this.setToken(data.accessToken);
          // Retry original request with new token
          headers["Authorization"] = `Bearer ${data.accessToken}`;
          const retryResponse = await fetch(`${this.baseUrl}${path}`, {
            ...fetchOptions,
            headers,
            credentials: "include",
          });
          if (retryResponse.ok) {
            return retryResponse.json();
          }
        }
      } catch {
        // Refresh failed
      }
      // If refresh also failed, clear token and redirect to login
      this.setToken(null);
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Request failed" }));
      throw new Error(error.message ?? `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  // Auth
  async devLogin() {
    const result = await this.request<{ accessToken: string; expiresIn: number; user: any }>("/auth/dev-login", {
      method: "POST",
      body: JSON.stringify({}),
    });
    this.setToken(result.accessToken);
    return result;
  }

  async login(provider: string, idToken: string) {
    return this.request<{ accessToken: string; expiresIn: number; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ provider, idToken }),
    });
  }

  async refreshToken() {
    return this.request<{ accessToken: string; expiresIn: number; user: any }>("/auth/refresh", {
      method: "POST",
    });
  }

  async getMe() {
    return this.request<any>("/auth/me");
  }

  async logout() {
    return this.request("/auth/logout", { method: "POST" });
  }

  async deleteAccount() {
    return this.request("/auth/account", { method: "DELETE" });
  }

  async deleteOrder(id: string) {
    return this.request(`/orders/${id}`, { method: "DELETE" });
  }

  async exportData() {
    return this.request<any>("/auth/export");
  }

  // Dashboard
  async getDashboard(period?: string) {
    const query = period ? `?period=${period}` : "";
    return this.request<any>(`/dashboard${query}`);
  }

  // Packages
  async getPackages(params?: Record<string, string>) {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<any>(`/packages${query}`);
  }

  async getPackage(id: string) {
    return this.request<any>(`/packages/${id}`);
  }

  async refreshPackage(id: string) {
    return this.request<any>(`/packages/${id}/refresh`, { method: "POST" });
  }

  async syncAllTracking() {
    return this.request<{ synced: number; errors: number; total: number }>("/packages/sync-all", { method: "POST" });
  }

  async addPackage(data: { trackingNumber: string; carrier?: string; description?: string }) {
    return this.request<{ success: boolean; orderId: string; packageId: string }>("/packages/add", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async scanText(text: string) {
    return this.request<{
      found: Array<{
        trackingNumber: string;
        carrier: string;
        alreadyTracked: boolean;
        packageId: string | null;
      }>;
      total: number;
    }>("/packages/scan-text", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  }

  // Ingest
  async getIngestKey() {
    return this.request<{ key: string | null }>("/ingest/key");
  }

  async generateIngestKey() {
    return this.request<{ key: string }>("/ingest/generate-key", { method: "POST" });
  }

  async importCsv(rows: Array<{ orderId?: string; trackingNumber?: string; store?: string; items?: string; date?: string }>) {
    return this.request<{ success: boolean; imported: number; skipped: number; total: number }>("/ingest/csv", {
      method: "POST",
      body: JSON.stringify({ rows }),
    });
  }

  // Orders
  async getOrder(id: string) {
    return this.request<any>(`/orders/${id}`);
  }

  // Email
  async getGmailAuthUrl() {
    return this.request<{ url: string }>("/email/connect/gmail");
  }

  async connectGmail(authCode: string) {
    return this.request<{ success: boolean; email: string }>("/email/connect/gmail/callback", {
      method: "POST",
      body: JSON.stringify({ provider: "GMAIL", authCode }),
    });
  }

  async syncEmails(full = true) {
    return this.request<{ success: boolean; emailsParsed: number; ordersCreated: number; totalOrders: number; totalTracking: number }>(
      `/email/sync${full ? "?full=true" : ""}`,
      { method: "POST", body: JSON.stringify({}) },
    );
  }

  async disconnectEmail(id: string) {
    return this.request(`/email/${id}`, { method: "DELETE" });
  }

  // Settings
  async getNotificationPreferences() {
    return this.request<any>("/settings/notifications");
  }

  async updateNotificationPreferences(data: any) {
    return this.request<any>("/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getVapidKey() {
    return this.request<{ publicKey: string }>("/settings/vapid-key");
  }

  async subscribePush(subscription: PushSubscription) {
    return this.request<{ success: boolean }>("/settings/notifications/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
  }

  async unsubscribePush() {
    return this.request<{ success: boolean }>("/settings/notifications/unsubscribe", {
      method: "POST",
    });
  }

  async getConnectedAccounts() {
    return this.request<any>("/settings/connected-accounts");
  }
}

export const api = new ApiClient(API_BASE);
