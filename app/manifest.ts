import type { MetadataRoute } from "next";

/** Web app manifest: name and icons used when the site is added to a phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Top 10 News Hourly",
    short_name: "Top 10 News",
    description: "Every hour’s top 10 news",
    start_url: "/",
    display: "standalone",
    background_color: "#f2efe6",
    theme_color: "#2f5239",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
