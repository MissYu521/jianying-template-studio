/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // fluent-ffmpeg / ffmpeg-static / ffprobe-static 依赖 Node 原生能力与 __dirname，
    // 保持为外部包，避免被打包进 server bundle 导致二进制路径失效
    serverComponentsExternalPackages: [
      "fluent-ffmpeg",
      "ffmpeg-static",
      "ffprobe-static",
    ],
  },
};

export default nextConfig;
