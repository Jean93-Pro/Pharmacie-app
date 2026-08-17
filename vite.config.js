import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Injecte automatiquement l'enregistrement du service worker —
      // aucune modification nécessaire dans main.jsx.
      injectRegister: "auto",
      includeAssets: ["favicon.png"],
      manifest: {
        name: "Officine — Gestion de pharmacie",
        short_name: "Officine",
        description: "Application de gestion de pharmacie : stock, ventes, clients, fournisseurs, comptabilité.",
        start_url: "/",
        display: "standalone",
        background_color: "#f8f4ea",
        theme_color: "#0a3a2e",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Précharge et sert depuis le cache tous les fichiers de
        // l'appli (HTML/JS/CSS/icônes) — l'appli s'ouvre et fonctionne
        // même sans réseau. Les données (Firestore) ont leur propre
        // cache géré séparément, voir firebase.js.
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
      },
    }),
  ],
});
