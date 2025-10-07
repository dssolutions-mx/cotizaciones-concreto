import type { NextConfig } from "next";

/**
 * Configuración optimizada de Next.js
 * - Configuramos el modo estricto de React para desarrollo
 * - Configuraciones para optimizar el rendimiento
 */
const nextConfig: NextConfig = {
  // Activar solo en desarrollo
  reactStrictMode: process.env.NODE_ENV === 'development',
  
  // Comprimir las imágenes para mejor rendimiento
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  
  // Enable standalone output for Vercel deployment
  output: 'standalone',

  // External packages configuration (moved from experimental)
  serverExternalPackages: [],

  // Explicitly disable the pages directory
  useFileSystemPublicRoutes: false,

  // Handle route groups properly for client reference manifests
  experimental: {
    // Ensure route groups are properly processed
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    // Enable proper handling of route groups
    serverComponentsExternalPackages: [],
  },
};

export default nextConfig;
