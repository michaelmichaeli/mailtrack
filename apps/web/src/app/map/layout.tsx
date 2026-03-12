import { Sidebar } from "@/components/layout/sidebar";
import { AuthGuard } from "@/components/layout/auth-guard";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Package Map" };

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden pt-14 md:pt-0">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
