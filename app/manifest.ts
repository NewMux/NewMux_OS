import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NEWMUX",
    short_name: "NEWMUX",
    description: "CRM, projects, finance and knowledge base for NEWMUX.",
    id: "/home",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f2f2f7",
    theme_color: "#f2f2f7",
    // Long-press the home-screen icon (item 38).
    shortcuts: [
      { name: "Add Expense", short_name: "Expense", url: "/finance/expenses?new=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Record Payment", short_name: "Payment", url: "/documents?type=invoice&status=unpaid", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "New Task", short_name: "Task", url: "/tasks?new=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
