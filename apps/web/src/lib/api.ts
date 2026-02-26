const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

interface FetchOptions extends RequestInit {
  token?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  getToken() {
    return this.token;
  }

  private async request<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options;
    const authToken = token ?? this.token;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((fetchOptions.headers as Record<string, string>) ?? {}),
    };

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...fetchOptions,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Request failed" }));
      throw new Error(error.message ?? `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
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

  async exportData() {
    return this.request<any>("/auth/export");
  }

  // Dashboard
  async getDashboard() {
    return this.request<any>("/dashboard");
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

  async syncEmails() {
    return this.request<{ success: boolean; emailsParsed: number; ordersCreated: number }>("/email/sync", {
      method: "POST",
    });
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

  async getConnectedAccounts() {
    return this.request<any>("/settings/connected-accounts");
  }
}

export const api = new ApiClient(API_BASE);
