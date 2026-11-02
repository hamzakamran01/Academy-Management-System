import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Campusly", template: "%s · Campusly" },
  description: "Attendance, results, teaching progress and fees — for owners, teachers and parents.",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#13151f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={inter.variable} suppressHydrationWarning>
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
