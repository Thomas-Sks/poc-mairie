import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Réutilise pendant 30 s une page déjà visitée : retour instantané sur les écrans consultés.
    // Toute action (Server Action + revalidatePath) vide ce cache, les données restent à jour.
    staleTimes: { dynamic: 30 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
