import type { Metadata, Viewport } from "next";
import { Figtree, Manrope } from "next/font/google";
import { site } from "@/lib/config";
import "./globals.css";

// Manrope for the wordmark and small caps labels; Figtree (warm, open, very legible) for reading.
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const figtree = Figtree({ subsets: ["latin", "latin-ext"], variable: "--font-figtree", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: "Top 10 News Hourly — Finite, High-Signal Headlines",
  description: "The 10 hottest stories in Finance & Markets, Tech & AI, Politics, World and Health, locked every hour.",
  openGraph: { title: "Top 10 News Hourly", description: "Every hour’s top 10 news", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#121512" },
  ],
};

// Applies the saved/system theme before first paint (no flash).
const cfAnalyticsToken = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;

const themeScript = `(function(){try{var t=localStorage.getItem("top10_theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark");if(!matchMedia("(prefers-reduced-motion: reduce)").matches&&"IntersectionObserver"in window)document.documentElement.classList.add("js-motion")}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${figtree.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-paper-50 text-stone-900 dark:bg-paper-950 dark:text-stone-100 antialiased font-sans selection:bg-amber-200 selection:text-stone-900 dark:selection:bg-amber-800 dark:selection:text-white">
        {children}
        {/* Cloudflare Web Analytics: cookieless page-view counts. Set NEXT_PUBLIC_CF_ANALYTICS_TOKEN to turn it on. */}
        {cfAnalyticsToken && (
          <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token: cfAnalyticsToken })} />
        )}
      </body>
    </html>
  );
}
