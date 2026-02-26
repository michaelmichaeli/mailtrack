import { Sidebar } from "@/components/layout/sidebar";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8 max-w-3xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
