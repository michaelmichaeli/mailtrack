/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@mailtrack/shared", "@mailtrack/ui"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
