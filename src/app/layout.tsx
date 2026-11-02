import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Campusly", template: "%s · Campusly" },
  description: "Results, teaching progress and fees — for owners, teachers and parents.",
  applicationName: "Campusly",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Campusly", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8f9fc",
  colorScheme: "light",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Light is the default; dark only when the user chose it (saved per device).
  const dark = (await cookies()).get(THEME_COOKIE)?.value === "dark";
  return (
    <html lang="en" dir="ltr" className={inter.variable} data-theme={dark ? "dark" : undefined} suppressHydrationWarning>
      <body>
        {children}
        <Toaster
          position="top-center"
          offset={16}
          toastOptions={{
            classNames: {
              toast: "!rounded-xl !border !border-border !bg-surface !text-fg !shadow-raised !font-sans",
              description: "!text-muted",
              actionButton: "!bg-primary !text-primary-fg !font-semibold !rounded-md",
            },
          }}
        />
      </body>
    </html>
  );
}
