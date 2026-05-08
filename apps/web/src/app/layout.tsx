import type { Metadata } from "next";
import { Noto_Sans, Noto_Serif, Noto_Sans_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Indian script support: Devanagari (Hindi) via Noto Sans subset.
// Telugu requires Noto_Sans_Telugu loaded separately (different Google Fonts entry).
// Do NOT substitute Latin-only serifs — they break Indian script rendering.
const notoSans = Noto_Sans({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const notoSansMono = Noto_Sans_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StockRight",
  description: "Cold storage management for warehouse operators",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${notoSans.variable} ${notoSerif.variable} ${notoSansMono.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
