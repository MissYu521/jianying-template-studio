"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatTime } from "@/lib/format";
import ImportGuide from "@/components/ImportGuide";
import type {
  AiReportData,
  AnalysisResultData,
  ShotFrameInput,
} from "@/lib/types";

interface ResultData {
  analysis: AnalysisResultData;
  report: AiReportData | null;
}

function Badge({
  children,
  tone = "indigo",
}: {
  children: React.ReactNode;
  tone?: "indigo" | "purple" | "blue";
}) {
  const tones = {
    indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    purple: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export default function ReportView({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResultData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/result/${jobId}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setData(json.data as ResultData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  /** AI 报告重试（报告不存在或此前失败时） */
  const retryAiReport = useCallback(async () => {
    if (!data) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const a = data.analysis;
      const shots: ShotFrameInput[] = a.shots.map((shot) => {
        const mid = (shot.start + shot.end) / 2;
        const frameIdx = Math.min(
          Math.max(Math.floor(mid * 2) + 1, 1),
          a.frameCount
        );
        return {
          ...shot,
          frameUrl: `/frames/${a.jobId}/frame-${String(frameIdx).padStart(4, "0")}.jpg`,
        };
      });
      const res = await fetch("/api/analyze/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: a.jobId,
          duration: a.duration,
          width: a.width,
          height: a.height,
          shots,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await load();
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI 分析失败，请稍后重试。");
    } finally {
      setAiLoading(false);
    }
  }, [data, load]);

  const analysis = data?.analysis ?? null;
  const report = data?.report ?? null;

  /** 字幕风格聚合：含字幕镜头数、位置与样式 */
  const subtitleStats = useMemo(() => {
    if (!report) return null;
    const analyzed = report.shots.filter((s) => s.analyzed);
    const withSub = analyzed.filter((s) => s.subtitle.exists);
    return {
      count: withSub.length,
      total: analyzed.length,
      positions: Array.from(
        new Set(withSub.map((s) => s.subtitle.position).filter(Boolean))
      ),
      styles: Array.from(
        new Set(withSub.map((s) => s.subtitle.style).filter(Boolean))
      ).slice(0, 3),
    };
  }, [report]);

  /** 调色风格聚合：去重的画面风格描述 */
  const colorStyles = useMemo(() => {
    if (!report) return [];
    return Array.from(
      new Set(
        report.shots.filter((s) => s.analyzed).map((s) => s.visualStyle)
      )
    ).slice(0, 4);
  }, [report]);

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-32 sm:px-6 lg:px-8">
        <svg
          className="h-8 w-8 animate-spin text-indigo-400"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4Z" />
        </svg>
        <p className="mt-4 text-sm text-slate-400">正在加载分析报告…</p>
      </main>
    );
  }

  if (error || !analysis) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-32 text-center sm:px-6 lg:px-8">
        <p className="text-lg font-semibold text-white">无法加载分析结果</p>
        <p className="mt-2 text-sm text-slate-400">{error ?? "结果不存在"}</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-medium text-white shadow-glow"
        >
          返回首页重新上传
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* 标题栏 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/"
            className="text-xs text-slate-500 transition-colors hover:text-indigo-300"
          >
            ← 返回首页
          </Link>
          <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl">
            剪辑手法<span className="text-gradient">分析报告</span>
          </h1>
          <p className="mt-1.5 text-xs text-slate-500 sm:text-sm">
            总时长 {formatTime(analysis.duration)} · {analysis.shotCount} 个镜头
            · {analysis.width}×{analysis.height}
            {report && (
              <>
                {" "}
                · AI 分析 {report.analyzedShots}/{report.totalShots} 镜头
              </>
            )}
          </p>
        </div>
        <Link
          href={`/generate/${jobId}`}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-105 active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          生成剪映草稿模板
        </Link>
      </div>

      {/* 双栏布局：移动端分析在前，桌面端左预览右分析 */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 左侧：视频回放 + 关键帧预览 + 镜头列表 */}
        <div className="order-2 space-y-6 lg:order-1">
          {/* 原视频回放 */}
          {analysis.videoUrl && (
            <div className="glass-card overflow-hidden rounded-2xl">
              <video
                src={analysis.videoUrl}
                controls
                playsInline
                className="aspect-video w-full bg-black object-contain"
              />
            </div>
          )}

          {/* 关键帧预览墙 */}
          <div className="glass-card rounded-2xl p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white sm:text-base">
              <span className="h-4 w-1 rounded-full bg-brand-gradient" />
              关键帧预览
              <span className="ml-auto text-[11px] font-normal text-slate-500">
                每秒 2 帧 · 展示 {analysis.frames.length}/{analysis.frameCount}
              </span>
            </h2>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {analysis.frames.map((frame) => (
                <div
                  key={frame.url}
                  className="group relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-black/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={frame.url}
                    alt={`第 ${formatTime(frame.time)} 秒关键帧`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-px text-[9px] tabular-nums text-slate-200">
                    {formatTime(frame.time)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 镜头列表 */}
          <div className="glass-card rounded-2xl p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white sm:text-base">
              <span className="h-4 w-1 rounded-full bg-brand-gradient" />
              镜头列表
              <span className="ml-auto text-[11px] font-normal text-slate-500">
                共 {analysis.shotCount} 个
              </span>
            </h2>
            <div className="mt-4 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
              {analysis.shots.map((shot) => {
                const ai = report?.shots.find((s) => s.index === shot.index);
                const mid = (shot.start + shot.end) / 2;
                const frameIdx = Math.min(
                  Math.max(Math.floor(mid * 2) + 1, 1),
                  analysis.frameCount
                );
                const thumb =
                  ai?.frameUrl ??
                  `/frames/${analysis.jobId}/frame-${String(frameIdx).padStart(4, "0")}.jpg`;
                return (
                  <div
                    key={shot.index}
                    className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb}
                        alt={`镜头 ${shot.index + 1}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-white">
                          镜头 {shot.index + 1}
                        </span>
                        <span className="text-[10px] tabular-nums text-slate-500">
                          {formatTime(shot.start)} - {formatTime(shot.end)} ·{" "}
                          {shot.duration.toFixed(1)}s
                        </span>
                        {ai?.analyzed && (
                          <>
                            <Badge tone="blue">{ai.shotType}</Badge>
                            <Badge tone="purple">{ai.cameraMovement}</Badge>
                          </>
                        )}
                      </div>
                      {ai?.analyzed && (
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                          {ai.summary}
                          {ai.subtitle.exists && (
                            <span className="text-slate-500">
                              {" "}
                              · 字幕（{ai.subtitle.position}）
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右侧：AI 四维分析 */}
        <div className="order-1 lg:order-2">
          {report ? (
            <div className="space-y-4">
              {/* 四维卡片 */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* 剪辑节奏 */}
                <div className="glass-card rounded-2xl p-4 sm:p-5">
                  <p className="text-[11px] font-medium text-indigo-300">
                    剪辑节奏
                  </p>
                  <p className="text-gradient mt-2 text-2xl font-bold">
                    {report.global.editingPace}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    {report.global.paceDescription}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    平均镜头时长 {report.avgShotDuration.toFixed(1)}s
                  </p>
                </div>

                {/* 转场风格 */}
                <div className="glass-card rounded-2xl p-4 sm:p-5">
                  <p className="text-[11px] font-medium text-indigo-300">
                    转场风格
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {report.global.transitions.map((t) => (
                      <span
                        key={t}
                        className="rounded-lg bg-brand-gradient-soft px-3 py-1.5 text-sm font-medium text-white"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    基于相邻镜头画面特征的转场类型推断
                  </p>
                </div>

                {/* 字幕风格 */}
                <div className="glass-card rounded-2xl p-4 sm:p-5">
                  <p className="text-[11px] font-medium text-indigo-300">
                    字幕风格
                  </p>
                  {subtitleStats && subtitleStats.count > 0 ? (
                    <>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {subtitleStats.count}/{subtitleStats.total} 个镜头含字幕
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {subtitleStats.positions.map((p) => (
                          <Badge key={p}>位置·{p}</Badge>
                        ))}
                        {subtitleStats.styles.map((s) => (
                          <Badge key={s} tone="purple">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">
                      未检测到烧录字幕，可在生成草稿时添加
                    </p>
                  )}
                </div>

                {/* 调色风格 */}
                <div className="glass-card rounded-2xl p-4 sm:p-5">
                  <p className="text-[11px] font-medium text-indigo-300">
                    调色风格
                  </p>
                  {colorStyles.length > 0 ? (
                    <ul className="mt-2 space-y-1.5">
                      {colorStyles.map((style) => (
                        <li
                          key={style}
                          className="flex items-start gap-1.5 text-xs leading-relaxed text-slate-300"
                        >
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
                          {style}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">未识别</p>
                  )}
                </div>
              </div>

              {/* 视频结构 */}
              <div className="glass-card rounded-2xl p-4 sm:p-5">
                <p className="text-[11px] font-medium text-indigo-300">
                  视频结构
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    { title: "开头钩子", desc: report.global.structure.opening },
                    { title: "中间内容", desc: report.global.structure.body },
                    { title: "结尾处理", desc: report.global.structure.ending },
                  ].map((stage) => (
                    <div
                      key={stage.title}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5"
                    >
                      <p className="text-xs font-semibold text-white">
                        {stage.title}
                      </p>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                        {stage.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 整体总结 + BGM */}
              <div className="glass-card rounded-2xl border-indigo-500/20 bg-indigo-500/5 p-4 sm:p-5">
                <p className="text-[11px] font-medium text-indigo-300">
                  整体剪辑手法总结
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">
                  {report.global.overallSummary}
                </p>
                <p className="mt-3 border-t border-white/5 pt-3 text-xs text-slate-400">
                  <span className="text-slate-500">BGM 风格推测：</span>
                  {report.global.bgmStyle}
                </p>
              </div>
            </div>
          ) : (
            /* AI 报告缺失：重试入口 */
            <div className="glass-card flex h-full min-h-64 flex-col items-center justify-center rounded-2xl p-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient-soft">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-indigo-300" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
              </span>
              <p className="mt-4 text-sm font-medium text-white">
                AI 剪辑手法分析尚未生成
              </p>
              <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500">
                {aiError ?? "点击下方按钮，由豆包大模型逐镜头分析景别、运镜、字幕与调色风格。"}
              </p>
              <button
                type="button"
                onClick={retryAiReport}
                disabled={aiLoading}
                className="mt-5 flex items-center gap-2 rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-medium text-white shadow-glow transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
              >
                {aiLoading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4Z" />
                    </svg>
                    AI 分析中…
                  </>
                ) : (
                  "生成 AI 分析"
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 底部 CTA */}
      <div className="mt-10 flex flex-col items-center gap-3">
        <Link
          href={`/generate/${jobId}`}
          className="flex w-full max-w-md items-center justify-center gap-2 rounded-xl bg-brand-gradient px-6 py-3.5 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
        >
          生成剪映草稿模板 →
        </Link>
        <p className="text-xs text-slate-500">
          选择画布比例与字幕样式，一键打包下载草稿 zip
        </p>
      </div>

      <ImportGuide />
    </main>
  );
}
