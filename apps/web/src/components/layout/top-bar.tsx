"use client";

import { NotificationBell } from "@/components/notifications/notification-bell";

export function TopBar() {
  return (
    <div className="flex justify-end px-6 pt-3 md:px-8">
      <NotificationBell />
    </div>
  );
}
