/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
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
      // Wadizは2026年10月から wadiz.io ドメインでも画像を配信している。
      // 許可し忘れると next/image が実行時エラーになり、一覧ページ全体が落ちる。
      { protocol: "https", hostname: "**.wadiz.io" },
      { protocol: "https", hostname: "**.zeczec.com" },
    ],
  },
};

export default nextConfig;
