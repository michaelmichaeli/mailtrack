import { z } from "zod";
import type {
  userSchema,
  createUserSchema,
  loginSchema,
  tokenResponseSchema,
  connectedEmailSchema,
  connectEmailSchema,
  connectedShopSchema,
  connectShopSchema,
  orderSchema,
  createOrderSchema,
  packageSchema,
  createPackageSchema,
  trackingEventSchema,
  notificationPreferenceSchema,
  updateNotificationPreferenceSchema,
  packageWithOrderSchema,
  dashboardResponseSchema,
  searchParamsSchema,
  apiErrorSchema,
} from "./schemas.js";

// ─── Inferred Types ───

export type User = z.infer<typeof userSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type LoginPayload = z.infer<typeof loginSchema>;
export type TokenResponse = z.infer<typeof tokenResponseSchema>;

export type ConnectedEmail = z.infer<typeof connectedEmailSchema>;
export type ConnectEmailPayload = z.infer<typeof connectEmailSchema>;

export type ConnectedShop = z.infer<typeof connectedShopSchema>;
export type ConnectShopPayload = z.infer<typeof connectShopSchema>;

export type Order = z.infer<typeof orderSchema>;
export type CreateOrder = z.infer<typeof createOrderSchema>;

export type Package = z.infer<typeof packageSchema>;
export type CreatePackage = z.infer<typeof createPackageSchema>;

export type TrackingEvent = z.infer<typeof trackingEventSchema>;

export type NotificationPreference = z.infer<
  typeof notificationPreferenceSchema
>;
export type UpdateNotificationPreference = z.infer<
  typeof updateNotificationPreferenceSchema
>;

export type PackageWithOrder = z.infer<typeof packageWithOrderSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

export type SearchParams = z.infer<typeof searchParamsSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

// ─── Utility Types ───

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Email Parser Types ───

export interface ParsedEmail {
  merchant: string;
  platform: ShopPlatform;
  orderId: string | null;
  trackingNumber: string | null;
  carrier: Carrier | null;
  items: string[];
  orderDate: string | null;
  totalAmount: number | null;
  currency: string | null;
  status: PackageStatus | null;
  pickupLocation: PickupLocation | null;
  confidence: number; // 0-1
}

export interface PickupLocation {
  address: string;
  hours: string;
  pickupCode: string | null;
  verificationCode: string | null;
}

export interface EmailParserResult {
  parsed: ParsedEmail[];
  rawEmailId: string;
  provider: EmailProvider;
}

// ─── Carrier Types ───

export interface CarrierTrackingResult {
  trackingNumber: string;
  carrier: Carrier;
  status: PackageStatus;
  estimatedDelivery: string | null;
  lastLocation: string | null;
  events: CarrierTrackingEvent[];
}

export interface CarrierTrackingEvent {
  timestamp: string;
  location: string | null;
  status: PackageStatus;
  description: string;
}

// ─── Shop Adapter Types ───

export interface ShopAdapter {
  name: ShopPlatform;
  parseEmail(html: string): ParsedEmail | null;
  fetchOrders?(token: string): Promise<Order[]>;
  fetchTracking?(orderId: string, token: string): Promise<CarrierTrackingResult | null>;
}

// Re-export enums for convenience
import {
  PackageStatus,
  AuthProvider,
  EmailProvider,
  ShopPlatform,
  Carrier,
  NotificationTrigger,
} from "./enums.js";

export {
  PackageStatus,
  AuthProvider,
  EmailProvider,
  ShopPlatform,
  Carrier,
  NotificationTrigger,
};
