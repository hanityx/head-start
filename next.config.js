/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  async redirects() {
    return [
      {
        source: "/view",
        destination: "/",
        permanent: false,
      },
    ];
  },
}

module.exports = nextConfig
