import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "剪映模板工坊 | AI 视频模板创作平台",
  description:
    "上传视频，由豆包大模型驱动的 AI 自动生成可复用的剪映模板，让视频创作更高效。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#05070F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-ink-950 text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
