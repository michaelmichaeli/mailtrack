/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@mailtrack/shared", "@mailtrack/ui"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
