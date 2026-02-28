import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/layout/providers";

const APP_NAME = "MailTrack";
const APP_DESCRIPTION = "Track all your packages from every store in one unified dashboard. Auto-syncs with Gmail, supports 30+ carriers, real-time status updates.";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3003";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Universal Package Tracking Dashboard`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: ["package tracking", "mail tracking", "delivery tracker", "AliExpress", "Amazon", "order tracking", "parcel tracker"],
  authors: [{ name: "MailTrack" }],
  creator: "MailTrack",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} — Universal Package Tracking Dashboard`,
    description: APP_DESCRIPTION,
    url: APP_URL,
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "MailTrack — Universal Package Tracking Dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — Universal Package Tracking Dashboard`,
    description: APP_DESCRIPTION,
    images: ["/og-image.svg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
