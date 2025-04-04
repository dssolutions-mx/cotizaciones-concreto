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
  
  // Improved output tracing to handle route groups
  output: 'standalone',
  
  // External packages configuration (moved from experimental)
  serverExternalPackages: [],
};

export default nextConfig;
