import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  // Un package-lock.json existe dans le dossier utilisateur : on fixe explicitement la racine du projet.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
