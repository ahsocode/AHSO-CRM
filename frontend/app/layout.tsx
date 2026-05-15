import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppProviders } from "@/components/providers";
import "./globals.css";
import "./polyfills";

const brandFont = localFont({
  src: [
    { path: "./fonts/BeVietnamPro-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/BeVietnamPro-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/BeVietnamPro-600.ttf", weight: "600", style: "normal" },
    { path: "./fonts/BeVietnamPro-700.ttf", weight: "700", style: "normal" },
    { path: "./fonts/BeVietnamPro-800.ttf", weight: "800", style: "normal" }
  ],
  variable: "--font-brand",
  display: "swap"
});

export const metadata: Metadata = {
  title: "AHSO CRM",
  description: "CRM quản lý vòng đời bán hàng kỹ thuật công nghiệp cho AHSO",
  manifest: "/manifest.json"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <meta name="theme-color" content="#1a5276" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={brandFont.variable}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
