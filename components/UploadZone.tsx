"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AiReportResponse,
  AnalysisResultData,
  AnalyzeResponse,
  ShotFrameInput,
} from "@/lib/types";

const MAX_SIZE_MB = 100;
const ALLOWED_EXT = [".mp4", ".mov"];
const ALLOWED_MIME = ["video/mp4", "video/quicktime"];

const STAGE_ANALYZE = [
  "正在上传视频…",
  "正在抽帧分析…",
  "检测镜头切换点…",
  "提取音频轨道…",
];
const STAGE_AI = [
  "正在生成剪辑手法分析报告…",
  "逐镜头分析景别与运镜…",
  "识别字幕与画面风格…",
  "推断剪辑节奏与视频结构…",
];

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

type Phase = "idle" | "ready" | "analyzing" | "aiAnalyzing";

export default function UploadZone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageIdx, setStageIdx] = useState(0);

  const processing = phase === "analyzing" || phase === "aiAnalyzing";
  const stages = phase === "aiAnalyzing" ? STAGE_AI : STAGE_ANALYZE;

  /** 前端预校验：格式 + 大小（后端仍会做最终校验） */
  const acceptFile = useCallback((selected: File | undefined) => {
    setError(null);
    if (!selected) return;

    const ext = selected.name
      .slice(selected.name.lastIndexOf("."))
      .toLowerCase();
    const mimeOk =
      ALLOWED_MIME.includes(selected.type.toLowerCase()) ||
      selected.type === "" ||
      selected.type === "application/octet-stream";
    if (!ALLOWED_EXT.includes(ext) || !mimeOk) {
      setError("仅支持 MP4 / MOV 格式的视频，请转换格式后再上传。");
      return;
    }
    if (selected.size === 0) {
      setError("文件为空，请选择有效的视频文件。");
      return;
    }
    if (selected.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`视频大小超过 ${MAX_SIZE_MB}MB 限制，请压缩后再上传。`);
      return;
    }
    setFile(selected);
    setPhase("ready");
  }, []);

  // 本地视频预览 URL 生命周期管理
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // 处理中：轮换阶段提示文案
  useEffect(() => {
    if (!processing) {
      setStageIdx(0);
      return;
    }
    const timer = setInterval(
      () => setStageIdx((i) => (i + 1) % stages.length),
      2200
    );
    return () => clearInterval(timer);
  }, [processing, stages.length]);

  const reset = useCallback(() => {
    setFile(null);
    setError(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  /** 为每个镜头挑选代表帧（取镜头中点对应的抽帧，fps=2） */
  const buildShotFrames = useCallback(
    (data: AnalysisResultData): ShotFrameInput[] =>
      data.shots.map((shot) => {
        const mid = (shot.start + shot.end) / 2;
        const frameIdx = Math.min(
          Math.max(Math.floor(mid * 2) + 1, 1),
          data.frameCount
        );
        return {
          ...shot,
          frameUrl: `/frames/${data.jobId}/frame-${String(frameIdx).padStart(4, "0")}.jpg`,
        };
      }),
    []
  );

  /** 完整流程：视频解析 → AI 报告 → 跳转报告页 */
  const analyze = useCallback(async () => {
    if (!file || processing) return;
    setPhase("analyzing");
    setError(null);

    let analysisData: AnalysisResultData;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const json: AnalyzeResponse = await res.json();
      if (!json.ok) throw new Error(json.error);
      analysisData = json.data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络异常，请检查连接后重试。");
      setPhase("ready");
      return;
    }

    // AI 剪辑手法分析（失败不阻断跳转，报告页提供重试）
    setPhase("aiAnalyzing");
    try {
      const res = await fetch("/api/analyze/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: analysisData.jobId,
          duration: analysisData.duration,
          width: analysisData.width,
          height: analysisData.height,
          shots: buildShotFrames(analysisData),
        }),
      });
      const json: AiReportResponse = await res.json();
      if (!json.ok) {
        console.warn("AI 报告生成失败：", json.error);
      }
    } catch {
      // 忽略，跳转后报告页可重试
    }

    router.push(`/report/${analysisData.jobId}`);
  }, [file, processing, buildShotFrames, router]);

  return (
    <section id="upload" className="pb-16 pt-14 sm:pb-20 sm:pt-20">
      {/* Hero 文案 */}
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
          由豆包大模型驱动
        </span>
        <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
          上传视频，AI 自动解析
          <span className="text-gradient"> 剪辑手法</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
          智能抽帧、镜头切换检测与剪辑手法分析一步到位，
          一键生成剪映草稿模板。
        </p>
      </div>

      {/* 上传 / 预览 / 进度卡片 */}
      <div className="glass-card mx-auto mt-10 max-w-3xl rounded-2xl p-4 shadow-2xl sm:p-6">
        {!file ? (
          <div
            role="button"
            tabIndex={0}
            aria-label="上传视频"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              acceptFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-all sm:py-20 ${
              isDragging
                ? "border-indigo-400 bg-indigo-500/10 shadow-glow"
                : "border-white/10 bg-white/[0.02] hover:border-indigo-500/40 hover:bg-indigo-500/5"
            }`}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient-soft">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-7 w-7 text-indigo-300"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                />
              </svg>
            </span>
            <p className="mt-5 text-sm font-medium text-white sm:text-base">
              点击选择或拖拽视频到此处
            </p>
            <p className="mt-2 text-xs text-slate-500 sm:text-sm">
              仅支持 MP4 / MOV，单个文件不超过 {MAX_SIZE_MB}MB
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
            {previewUrl && (
              <video
                src={previewUrl}
                controls
                playsInline
                className="aspect-video w-full bg-black object-contain"
              />
            )}
            <div className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {file.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatSize(file.size)} ·{" "}
                  {processing ? "AI 处理中…" : "已就绪"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={reset}
                  disabled={processing}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  重新选择
                </button>
                <button
                  type="button"
                  onClick={analyze}
                  disabled={processing}
                  className="flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-glow transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
                >
                  {processing ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-90"
                          fill="currentColor"
                          d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4Z"
                        />
                      </svg>
                      处理中…
                    </>
                  ) : (
                    "开始分析"
                  )}
                </button>
              </div>
            </div>

            {/* 处理进度 */}
            {processing && (
              <div className="border-t border-white/10 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-xs text-indigo-300 sm:text-sm">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                    {stages[stageIdx]}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    第 {phase === "analyzing" ? "1" : "2"}/2 步
                  </span>
                </div>
                <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/5">
                  <div className="h-full w-1/3 animate-[progress_1.6s_ease-in-out_infinite] rounded-full bg-brand-gradient" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mx-auto mt-4 max-w-3xl rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".mp4,.mov,video/mp4,video/quicktime"
        className="hidden"
        onChange={(e) => acceptFile(e.target.files?.[0])}
      />

      {/* 数据指标 */}
      <div className="mx-auto mt-10 grid max-w-3xl grid-cols-3 gap-3 sm:gap-6">
        {[
          { value: "2 帧/秒", label: "智能抽帧采样" },
          { value: "scdet", label: "场景切换检测" },
          { value: "100MB", label: "单文件上限" },
        ].map((item) => (
          <div
            key={item.label}
            className="glass-card rounded-xl px-3 py-4 text-center sm:py-5"
          >
            <p className="text-gradient text-xl font-bold sm:text-2xl">
              {item.value}
            </p>
            <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
