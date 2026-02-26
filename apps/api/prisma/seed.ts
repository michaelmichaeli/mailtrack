import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  console.log("🌱 Seeding database...");

  // Create dev user
  const user = await prisma.user.upsert({
    where: { email: "dev@mailtrack.local" },
    update: {},
    create: {
      email: "dev@mailtrack.local",
      name: "Dev User",
      authProvider: "GOOGLE",
      notificationPreference: {
        create: { pushEnabled: true, emailEnabled: false },
      },
    },
  });

  console.log(`  ✅ User: ${user.email} (${user.id})`);

  const now = new Date();
  const day = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  // Create orders and packages
  const orders = [
    {
      shopPlatform: "AMAZON" as const,
      externalOrderId: "114-3941689-8772232",
      orderDate: day(-5),
      merchant: "Amazon.com",
      totalAmount: 49.99,
      currency: "USD",
      packages: [
        {
          trackingNumber: "1Z999AA10123456784",
          carrier: "UPS" as const,
          status: "IN_TRANSIT" as const,
          estimatedDelivery: day(1),
          lastLocation: "Memphis, TN",
          items: '["Wireless Bluetooth Headphones"]',
          events: [
            { timestamp: day(-3), location: "Seattle, WA", status: "ORDERED" as const, description: "Order placed" },
            { timestamp: day(-2), location: "Seattle, WA", status: "SHIPPED" as const, description: "Shipped from warehouse" },
            { timestamp: day(-1), location: "Memphis, TN", status: "IN_TRANSIT" as const, description: "In transit — package arrived at UPS facility" },
          ],
        },
      ],
    },
    {
      shopPlatform: "ALIEXPRESS" as const,
      externalOrderId: "8134726481927364",
      orderDate: day(-14),
      merchant: "AliExpress",
      totalAmount: 12.50,
      currency: "USD",
      packages: [
        {
          trackingNumber: "LP00123456789012",
          carrier: "CAINIAO" as const,
          status: "IN_TRANSIT" as const,
          estimatedDelivery: day(7),
          lastLocation: "Guangzhou, China",
          items: '["USB-C Hub Adapter"]',
          events: [
            { timestamp: day(-12), location: "Shenzhen, China", status: "ORDERED" as const, description: "Seller shipped your order" },
            { timestamp: day(-10), location: "Guangzhou, China", status: "IN_TRANSIT" as const, description: "Departed origin country" },
          ],
        },
      ],
    },
    {
      shopPlatform: "EBAY" as const,
      externalOrderId: "12-34567-89012",
      orderDate: day(-2),
      merchant: "TechDeals Store",
      totalAmount: 159.00,
      currency: "USD",
      packages: [
        {
          trackingNumber: "9400111899223100012345",
          carrier: "USPS" as const,
          status: "OUT_FOR_DELIVERY" as const,
          estimatedDelivery: day(0),
          lastLocation: "Your City, ST",
          items: '["Mechanical Keyboard — Cherry MX Brown"]',
          events: [
            { timestamp: day(-2), location: "Chicago, IL", status: "SHIPPED" as const, description: "Shipped" },
            { timestamp: day(-1), location: "Your City, ST", status: "IN_TRANSIT" as const, description: "Arrived at local post office" },
            { timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000), location: "Your City, ST", status: "OUT_FOR_DELIVERY" as const, description: "Out for delivery" },
          ],
        },
      ],
    },
    {
      shopPlatform: "AMAZON" as const,
      externalOrderId: "114-5678901-2345678",
      orderDate: day(-7),
      merchant: "Amazon.com",
      totalAmount: 29.99,
      currency: "USD",
      packages: [
        {
          trackingNumber: "786100123456",
          carrier: "FEDEX" as const,
          status: "DELIVERED" as const,
          estimatedDelivery: day(-2),
          lastLocation: "Front door",
          items: '["Phone Case", "Screen Protector"]',
          events: [
            { timestamp: day(-6), location: "Lexington, KY", status: "SHIPPED" as const, description: "Picked up" },
            { timestamp: day(-4), location: "Indianapolis, IN", status: "IN_TRANSIT" as const, description: "In transit" },
            { timestamp: day(-2), location: "Your City, ST", status: "DELIVERED" as const, description: "Delivered — left at front door" },
          ],
        },
      ],
    },
    {
      shopPlatform: "ETSY" as const,
      externalOrderId: "2987654321",
      orderDate: day(-1),
      merchant: "HandmadeByJane",
      totalAmount: 35.00,
      currency: "USD",
      packages: [
        {
          trackingNumber: "PENDING",
          carrier: "UNKNOWN" as const,
          status: "PROCESSING" as const,
          estimatedDelivery: day(5),
          lastLocation: null,
          items: '["Custom Engraved Wooden Sign"]',
          events: [
            { timestamp: day(-1), location: null, status: "ORDERED" as const, description: "Order confirmed — seller is preparing your item" },
          ],
        },
      ],
    },
    {
      shopPlatform: "AMAZON" as const,
      externalOrderId: "114-9876543-2109876",
      orderDate: day(-10),
      merchant: "Amazon.com",
      totalAmount: 89.99,
      currency: "USD",
      packages: [
        {
          trackingNumber: "JD014600012345678901",
          carrier: "DHL" as const,
          status: "EXCEPTION" as const,
          estimatedDelivery: day(-3),
          lastLocation: "Distribution Center",
          items: '["Portable Bluetooth Speaker"]',
          events: [
            { timestamp: day(-9), location: "Leipzig, DE", status: "SHIPPED" as const, description: "Shipment picked up" },
            { timestamp: day(-6), location: "Cincinnati, OH", status: "IN_TRANSIT" as const, description: "Arrived at DHL facility" },
            { timestamp: day(-3), location: "Distribution Center", status: "EXCEPTION" as const, description: "Delivery attempted — no access to delivery location" },
          ],
        },
      ],
    },
  ];

  for (const orderData of orders) {
    const existing = await prisma.order.findFirst({
      where: { userId: user.id, externalOrderId: orderData.externalOrderId },
    });
    if (existing) {
      console.log(`  ⏭️  Order ${orderData.externalOrderId} already exists, skipping`);
      continue;
    }

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        shopPlatform: orderData.shopPlatform,
        externalOrderId: orderData.externalOrderId,
        orderDate: orderData.orderDate,
        merchant: orderData.merchant,
        totalAmount: orderData.totalAmount,
        currency: orderData.currency,
      },
    });

    for (const pkgData of orderData.packages) {
      const pkg = await prisma.package.create({
        data: {
          orderId: order.id,
          trackingNumber: pkgData.trackingNumber,
          carrier: pkgData.carrier,
          status: pkgData.status,
          estimatedDelivery: pkgData.estimatedDelivery,
          lastLocation: pkgData.lastLocation,
          items: pkgData.items,
        },
      });

      for (const event of pkgData.events) {
        await prisma.trackingEvent.create({
          data: {
            packageId: pkg.id,
            timestamp: event.timestamp,
            location: event.location,
            status: event.status,
            description: event.description,
          },
        });
      }
    }

    console.log(`  ✅ Order: ${orderData.merchant} — ${orderData.externalOrderId}`);
  }

  console.log("🌱 Seeding complete!");
}

seed()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
