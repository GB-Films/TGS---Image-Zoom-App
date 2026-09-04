import type { Metadata, Viewport } from "next";
import "./globals.css";

const PUBLIC_ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const publicAsset = (path: string) => `${PUBLIC_ASSET_BASE}${path}`;

export const metadata: Metadata = {
  title: "TGS | Zoom infinito",
  description: "Experiencia interactiva de zoom infinito de TGS para iPad.",
  applicationName: "TGS",
  manifest: publicAsset("/manifest.webmanifest"),
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TGS",
  },
  icons: {
    icon: [
      { url: publicAsset("/brand/icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: publicAsset("/brand/icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
    apple: publicAsset("/brand/apple-touch-icon.png"),
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
        <link rel="preload" as="image" href={publicAsset("/scenes/scene-01-majestic-mountains.webp")} type="image/webp" />
        <link rel="preload" as="image" href={publicAsset("/scenes/scene-02-sunset-colors.webp")} type="image/webp" />
      </head>
      <body>{children}</body>
    </html>
  );
}
