import Header from "@/components/Header";
import UploadZone from "@/components/UploadZone";
import FeaturesSection from "@/components/FeaturesSection";
import ShowcaseSection from "@/components/ShowcaseSection";
import ImportGuide from "@/components/ImportGuide";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* 背景装饰：网格 + 蓝紫光晕 */}
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[140px]" />
      <div className="pointer-events-none absolute right-[-120px] top-1/3 h-[360px] w-[360px] rounded-full bg-purple-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-80px] left-[-120px] h-[320px] w-[320px] rounded-full bg-blue-600/15 blur-[120px]" />

      <div className="relative">
        <Header />
        <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <UploadZone />
          <FeaturesSection />
          <ShowcaseSection />
        </main>
        <ImportGuide />
        <Footer />
      </div>
    </div>
  );
}
