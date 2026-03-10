import { notifyStatusChange } from "./notification.service.js";

const STATUS_PRIORITY: Record<string, number> = {
  ORDERED: 0, PROCESSING: 1, SHIPPED: 2, IN_TRANSIT: 3,
  OUT_FOR_DELIVERY: 4, PICKED_UP: 5, DELIVERED: 6, RETURNED: 6, EXCEPTION: 3,
};

const TERMINAL_STATUSES = ["DELIVERED", "RETURNED", "PICKED_UP"];

/**
 * Sync tracking result into the database for a given package.
 * Handles status updates, event deduplication, carrier correction,
 * pickup location enrichment, push notifications, and status reconciliation.
 */
export async function syncPackageFromResult(prisma: any, packageId: string, result: any) {
  // Get current package to detect status change
  const currentPkg = await prisma.package.findUnique({
    where: { id: packageId },
    include: { order: { select: { id: true, userId: true } } },
  });
  const oldStatus = currentPkg?.status;

  // Never downgrade from terminal statuses (DELIVERED, RETURNED)
  if (TERMINAL_STATUSES.includes(oldStatus) && !TERMINAL_STATUSES.includes(result.status)) {
    result.status = oldStatus;
  }

  // Update package status, location, pickup info, and estimated delivery
  const updateData: any = {
    status: result.status as any,
    lastLocation: result.lastLocation ?? null,
    ...(result.estimatedDelivery ? { estimatedDelivery: new Date(result.estimatedDelivery) } : {}),
  };

  // Update carrier if tracking provider detected a more specific one
  if (result.carrier && result.carrier !== "UNKNOWN" && result.carrier !== "ALIEXPRESS_STANDARD" && currentPkg?.carrier !== result.carrier) {
    updateData.carrier = result.carrier;
  }

  // Save pickup/carrier info
  if (result.pickupLocation) {
    if (result.pickupLocation.carrierOnly) {
      updateData.pickupLocation = JSON.stringify(result.pickupLocation);
    } else if (result.pickupLocation.address || result.pickupLocation.pickupCode) {
      try {
        const { enrichPickupLocation } = await import("./places.service.js");
        const enriched = await enrichPickupLocation(result.pickupLocation);
        if (enriched) {
          updateData.pickupLocation = JSON.stringify(enriched);
        }
      } catch {
        updateData.pickupLocation = JSON.stringify(result.pickupLocation);
      }
    }
  }

  await prisma.package.update({
    where: { id: packageId },
    data: updateData,
  });

  // Keep order status in sync with package status
  if (currentPkg) {
    await prisma.order.update({
      where: { id: currentPkg.order.id },
      data: { status: result.status as any },
    });
  }

  // Send push notification if status changed
  if (currentPkg && oldStatus !== result.status) {
    try {
      await notifyStatusChange(
        prisma,
        currentPkg.order.userId,
        currentPkg.trackingNumber,
        oldStatus,
        result.status,
        packageId
      );
    } catch (e) {
      console.error("[notify] Error sending notification:", e);
    }
  }

  // If tracking returned a status but no events, create a synthetic event
  // so the timeline isn't empty
  if (result.events.length === 0 && result.status && result.status !== oldStatus) {
    const existingEvents = await prisma.trackingEvent.count({ where: { packageId } });
    if (existingEvents === 0) {
      await prisma.trackingEvent.create({
        data: {
          packageId,
          timestamp: new Date(),
          location: result.lastLocation || null,
          status: result.status as any,
          description: `Package status: ${result.status.replace(/_/g, " ").toLowerCase()}`,
        },
      });
    }
  }

  // Upsert events — deduplicate by timestamp+description or by status within time window
  for (const event of result.events) {
    const eventTime = new Date(event.timestamp);
    const windowStart = new Date(eventTime.getTime() - 2000);
    const windowEnd = new Date(eventTime.getTime() + 2000);

    const exactMatch = await prisma.trackingEvent.findFirst({
      where: {
        packageId,
        timestamp: { gte: windowStart, lte: windowEnd },
        description: event.description,
      },
    });

    if (exactMatch) {
      if (event.location !== exactMatch.location) {
        await prisma.trackingEvent.update({
          where: { id: exactMatch.id },
          data: { location: event.location },
        });
      }
    } else {
      // Check for same-status event within 6 hours (likely duplicate from different source)
      const statusWindow = 6 * 60 * 60 * 1000;
      const statusMatch = await prisma.trackingEvent.findFirst({
        where: {
          packageId,
          status: event.status as any,
          timestamp: {
            gte: new Date(eventTime.getTime() - statusWindow),
            lte: new Date(eventTime.getTime() + statusWindow),
          },
        },
      });

      if (statusMatch) {
        const shouldUpgrade = (event.location && !statusMatch.location) ||
          (event.description.length > (statusMatch.description?.length ?? 0));
        if (shouldUpgrade) {
          await prisma.trackingEvent.update({
            where: { id: statusMatch.id },
            data: {
              timestamp: eventTime,
              location: event.location || statusMatch.location,
              description: event.description,
            },
          });
        }
      } else {
        await prisma.trackingEvent.create({
          data: {
            packageId,
            timestamp: eventTime,
            location: event.location,
            status: event.status as any,
            description: event.description,
          },
        });
      }
    }
  }

  // Reconcile status: if any event has a higher-priority status than the package, upgrade it
  const allEvents = await prisma.trackingEvent.findMany({
    where: { packageId },
    select: { status: true },
  });
  let bestStatus = result.status;
  let bestPriority = STATUS_PRIORITY[bestStatus] ?? 0;
  for (const ev of allEvents) {
    const p = STATUS_PRIORITY[ev.status] ?? 0;
    if (p > bestPriority) {
      bestPriority = p;
      bestStatus = ev.status;
    }
  }
  if (bestStatus !== result.status) {
    console.log(`[sync] Reconciling status for ${packageId}: ${result.status} → ${bestStatus}`);
    await prisma.package.update({
      where: { id: packageId },
      data: { status: bestStatus as any },
    });
    if (currentPkg) {
      await prisma.order.update({
        where: { id: currentPkg.order.id },
        data: { status: bestStatus as any },
      });
    }
  }
}
