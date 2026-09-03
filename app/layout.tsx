import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TGS | Zoom infinito",
  description: "Experiencia interactiva de zoom infinito de TGS para iPad.",
  applicationName: "TGS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TGS",
  },
  icons: {
    icon: [
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#eef7f7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preload" as="image" href="/scenes/scene-01-majestic-mountains.webp" type="image/webp" />
        <link rel="preload" as="image" href="/scenes/scene-02-sunset-colors.webp" type="image/webp" />
      </head>
      <body>{children}</body>
    </html>
  );
}
