import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ReportView from "@/components/ReportView";

export const metadata: Metadata = {
  title: "剪辑手法分析报告 | 剪映模板工坊",
};

export default function ReportPage({
  params,
}: {
  params: { jobId: string };
}) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-80px] left-[-120px] h-[320px] w-[320px] rounded-full bg-blue-600/15 blur-[120px]" />

      <div className="relative">
        <Header />
        <ReportView jobId={params.jobId} />
        <Footer />
      </div>
    </div>
  );
}
