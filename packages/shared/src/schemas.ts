import { z } from "zod";
import {
  PackageStatus,
  AuthProvider,
  EmailProvider,
  ShopPlatform,
  Carrier,
} from "./enums.js";

// ─── User Schemas ───

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  avatar: z.string().url().nullable(),
  authProvider: z.nativeEnum(AuthProvider),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  avatar: z.string().url().nullable().optional(),
  authProvider: z.nativeEnum(AuthProvider),
});

// ─── Auth Schemas ───

export const loginSchema = z.object({
  provider: z.nativeEnum(AuthProvider),
  idToken: z.string().min(1),
});

export const tokenResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  user: userSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── Connected Email Schemas ───

export const connectedEmailSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  provider: z.nativeEnum(EmailProvider),
  email: z.string().email(),
  lastSyncAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const connectEmailSchema = z.object({
  provider: z.nativeEnum(EmailProvider),
  authCode: z.string().min(1),
});

// ─── Connected Shop Schemas ───

export const connectedShopSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  platform: z.nativeEnum(ShopPlatform),
  createdAt: z.string().datetime(),
});

export const connectShopSchema = z.object({
  platform: z.nativeEnum(ShopPlatform),
  authCode: z.string().min(1),
});

// ─── Order Schemas ───

export const orderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  shopPlatform: z.nativeEnum(ShopPlatform),
  externalOrderId: z.string().nullable(),
  orderDate: z.string().datetime().nullable(),
  merchant: z.string(),
  totalAmount: z.number().nullable(),
  currency: z.string().length(3).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createOrderSchema = z.object({
  shopPlatform: z.nativeEnum(ShopPlatform),
  externalOrderId: z.string().nullable().optional(),
  orderDate: z.string().datetime().nullable().optional(),
  merchant: z.string().min(1),
  totalAmount: z.number().nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
});

// ─── Package Schemas ───

export const packageSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  trackingNumber: z.string(),
  carrier: z.nativeEnum(Carrier),
  status: z.nativeEnum(PackageStatus),
  estimatedDelivery: z.string().datetime().nullable(),
  lastLocation: z.string().nullable(),
  items: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createPackageSchema = z.object({
  orderId: z.string().uuid(),
  trackingNumber: z.string().min(1),
  carrier: z.nativeEnum(Carrier),
  items: z.string().nullable().optional(),
});

// ─── Tracking Event Schemas ───

export const trackingEventSchema = z.object({
  id: z.string().uuid(),
  packageId: z.string().uuid(),
  timestamp: z.string().datetime(),
  location: z.string().nullable(),
  status: z.nativeEnum(PackageStatus),
  description: z.string(),
  createdAt: z.string().datetime(),
});

// ─── Notification Preference Schemas ───

export const notificationPreferenceSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  pushEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  quietHoursStart: z.string().nullable(),
  quietHoursEnd: z.string().nullable(),
});

export const updateNotificationPreferenceSchema = z.object({
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  quietHoursStart: z.string().nullable().optional(),
  quietHoursEnd: z.string().nullable().optional(),
});

// ─── Dashboard Schemas ───

export const packageWithOrderSchema = packageSchema.extend({
  order: orderSchema,
  events: z.array(trackingEventSchema).optional(),
});

export const dashboardResponseSchema = z.object({
  arrivingToday: z.array(packageWithOrderSchema),
  inTransit: z.array(packageWithOrderSchema),
  processing: z.array(packageWithOrderSchema),
  delivered: z.array(packageWithOrderSchema),
  exceptions: z.array(packageWithOrderSchema),
});

// ─── Search / Filter Schemas ───

export const searchParamsSchema = z.object({
  query: z.string().optional(),
  status: z.nativeEnum(PackageStatus).optional(),
  carrier: z.nativeEnum(Carrier).optional(),
  merchant: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  });

// ─── API Error Schema ───

export const apiErrorSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});
