import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ImportGuide from "@/components/ImportGuide";
import ReferenceStudio from "@/components/ReferenceStudio";

export const metadata: Metadata = {
  title: "AI 参考式成片生成 | 剪映模板工坊",
  description:
    "上传参考样片与自有素材，AI 解析剪辑范式并自动编排素材，一键生成剪映草稿。",
};

export default function ReferencePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[140px]" />
      <div className="pointer-events-none absolute right-[-120px] top-1/3 h-[360px] w-[360px] rounded-full bg-purple-600/15 blur-[120px]" />

      <div className="relative">
        <Header />
        <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          {/* 标题区 */}
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
              AI 参考式成片
            </span>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-4xl">
              上传参考样片，
              <span className="text-gradient">复刻它的剪辑节奏</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
              解析参考片的镜头时长模式、转场与风格，按该范式自动编排你的素材，
              生成可直接导入剪映专业版的草稿。
            </p>
          </div>

          <div className="mt-10">
            <ReferenceStudio />
          </div>
        </main>
        <ImportGuide />
        <Footer />
      </div>
    </div>
  );
}
