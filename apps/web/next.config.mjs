/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@mailtrack/shared", "@mailtrack/ui"],
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
