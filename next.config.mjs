/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.kickstarter.com" },
      { protocol: "https", hostname: "cdn.images.indiegogo.com" },
      { protocol: "https", hostname: "**.kickstarter.com" },
      { protocol: "https", hostname: "**.indiegogo.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.wadiz.kr" },
      { protocol: "https", hostname: "**.zeczec.com" },
    ],
  },
};

export default nextConfig;
