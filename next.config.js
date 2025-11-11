/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseHost;
try {
  if (supabaseUrl) {
    supabaseHost = new URL(supabaseUrl).hostname;
  }
} catch {}

const nextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  
  // ESLint config should live in eslint.config.js or .eslintrc.* in Next 16
  // Use default output mode for better Vercel compatibility with static assets
  // output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
    // Next 16 defaults changed; keep explicit overrides as needed
    minimumCacheTTL: 14400,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    qualities: [75, 85, 90],
    remotePatterns: supabaseHost
      ? [
          {
            protocol: 'https',
            hostname: supabaseHost,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
    unoptimized: false,
  },
};

module.exports = nextConfig; 