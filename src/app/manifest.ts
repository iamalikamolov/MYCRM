import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mijoz topish — CRM",
    short_name: "Mijoz topish",
    description: "Mijoz topish, qo'ng'iroqlar, sotuvlar va qarzlar — bir joyda.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0906",
    theme_color: "#0d0906",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
