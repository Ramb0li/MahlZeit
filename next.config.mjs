/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.meteoblue.com' },
    ],
  },
};

export default nextConfig;
