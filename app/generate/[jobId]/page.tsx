import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GenerateView from "@/components/GenerateView";

export const metadata: Metadata = {
  title: "生成剪映草稿模板 | 剪映模板工坊",
};

export default function GeneratePage({
  params,
}: {
  params: { jobId: string };
}) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[140px]" />
      <div className="pointer-events-none absolute right-[-120px] top-1/3 h-[360px] w-[360px] rounded-full bg-purple-600/15 blur-[120px]" />

      <div className="relative">
        <Header />
        <GenerateView jobId={params.jobId} />
        <Footer />
      </div>
    </div>
  );
}
