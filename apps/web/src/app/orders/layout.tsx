import { Sidebar } from "@/components/layout/sidebar";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Order Details" };

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 pt-16 md:pt-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
