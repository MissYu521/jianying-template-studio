"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ImportGuide from "@/components/ImportGuide";
import type { AiReportData, AnalysisResultData } from "@/lib/types";

interface ResultData {
  analysis: AnalysisResultData;
  report: AiReportData | null;
}

interface DraftSuccess {
  draftName: string;
  fileName: string;
  downloadUrl: string;
  shotCount: number;
  subtitleCount: number;
  transition: string;
  aspectRatio: string;
  durationSec: number;
}

type DraftResponse =
  | { ok: true; data: DraftSuccess }
  | { ok: false; error: string };

/** 画布比例选项（带视觉示意） */
const ASPECT_OPTIONS = [
  { value: "9:16", label: "9:16 竖屏", desc: "抖音 / 视频号 / 快手" },
  { value: "16:9", label: "16:9 横屏", desc: "B站 / 西瓜 / 网页" },
] as const;

/** 字幕样式预设（3-4 种） */
const SUBTITLE_PRESETS = [
  {
    id: "classic",
    name: "经典白字",
    position: "底部",
    font: "黑体",
    color: "#FFFFFF",
    fontSize: 15,
    desc: "底部 · 黑体 · 白色",
  },
  {
    id: "variety",
    name: "综艺黄字",
    position: "底部",
    font: "微软雅黑",
    color: "#FFE95B",
    fontSize: 18,
    desc: "底部 · 微软雅黑 · 亮黄",
  },
  {
    id: "cinema",
    name: "电影感字幕",
    position: "底部",
    font: "思源黑体",
    color: "#F5F5F5",
    fontSize: 20,
    desc: "底部 · 思源黑体 · 大字号",
  },
  {
    id: "title",
    name: "顶部标题",
    position: "顶部",
    font: "黑体",
    color: "#8BE9FD",
    fontSize: 20,
    desc: "顶部 · 黑体 · 冰蓝",
  },
] as const;

const TRANSITION_OPTIONS = ["硬切", "叠化", "闪黑", "闪白", "运镜转场", "匹配剪辑"];

export default function GenerateView({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResultData | null>(null);

  const [aspectRatio, setAspectRatio] = useState<string>("9:16");
  const [presetId, setPresetId] = useState<string>(SUBTITLE_PRESETS[0].id);
  const [transition, setTransition] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [result, setResult] = useState<DraftSuccess | null>(null);

  useEffect(() => {
    (async () => {
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
    })();
  }, [jobId]);

  const analysis = data?.analysis ?? null;
  const report = data?.report ?? null;

  const aiRecommendedTransition = report?.global.transitions[0] ?? null;
  const effectiveTransition = transition ?? aiRecommendedTransition ?? "硬切";
  const preset =
    SUBTITLE_PRESETS.find((p) => p.id === presetId) ?? SUBTITLE_PRESETS[0];

  /** 字幕文本：优先 AI 镜头内容概括，否则占位文本 */
  const subtitles = useMemo(() => {
    if (!analysis) return [];
    if (report && report.shots.some((s) => s.analyzed)) {
      return report.shots
        .filter((s) => s.analyzed)
        .map((s) => ({ start: s.start, end: s.end, text: s.summary }));
    }
    return analysis.shots.map((s) => ({
      start: s.start,
      end: s.end,
      text: `镜头 ${s.index + 1}`,
    }));
  }, [analysis, report]);

  const generate = useCallback(async () => {
    if (!analysis || generating) return;
    setGenerating(true);
    setGenError(null);
    setResult(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: analysis.jobId,
          aspectRatio,
          transition: effectiveTransition,
          shots: analysis.shots.map((s) => ({
            duration: s.duration,
            label: `镜头${s.index + 1}`,
          })),
          subtitles,
          subtitleStyle: {
            position: preset.position,
            font: preset.font,
            color: preset.color,
            fontSize: preset.fontSize,
          },
          audio: { duration: analysis.duration, volume },
        }),
      });
      const json: DraftResponse = await res.json();
      if (!json.ok) throw new Error(json.error);
      setResult(json.data);
    } catch (e) {
      setGenError(
        e instanceof Error ? e.message : "网络异常，请检查连接后重试。"
      );
    } finally {
      setGenerating(false);
    }
  }, [analysis, generating, aspectRatio, effectiveTransition, subtitles, preset, volume]);

  // 生成成功后自动触发下载
  useEffect(() => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.downloadUrl;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [result]);

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-32 sm:px-6 lg:px-8">
        <svg className="h-8 w-8 animate-spin text-indigo-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4Z" />
        </svg>
        <p className="mt-4 text-sm text-slate-400">正在加载…</p>
      </main>
    );
  }

  if (error || !analysis) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-32 text-center sm:px-6 lg:px-8">
        <p className="text-lg font-semibold text-white">无法生成草稿</p>
        <p className="mt-2 text-sm text-slate-400">{error ?? "数据缺失"}</p>
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
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {/* 标题栏 */}
      <div>
        <Link
          href={`/report/${jobId}`}
          className="text-xs text-slate-500 transition-colors hover:text-indigo-300"
        >
          ← 返回分析报告
        </Link>
        <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl">
          生成<span className="text-gradient">剪映草稿模板</span>
        </h1>
        <p className="mt-1.5 text-xs text-slate-500 sm:text-sm">
          基于 {analysis.shotCount} 个镜头 · 总时长{" "}
          {analysis.duration.toFixed(1)}s · {subtitles.length} 条字幕
        </p>
      </div>

      <div className="glass-card mt-8 rounded-2xl p-5 sm:p-8">
        {/* 目标比例 */}
        <div>
          <h2 className="text-sm font-semibold text-white">目标比例</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {ASPECT_OPTIONS.map((opt) => {
              const active = aspectRatio === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAspectRatio(opt.value)}
                  className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                    active
                      ? "border-indigo-500/60 bg-indigo-500/10 shadow-glow"
                      : "border-white/10 bg-white/[0.03] hover:border-indigo-500/30"
                  }`}
                >
                  {/* 比例示意框 */}
                  <span
                    className={`shrink-0 rounded-md border-2 ${
                      active ? "border-indigo-400" : "border-slate-600"
                    } ${
                      opt.value === "9:16" ? "h-16 w-9" : "h-9 w-16"
                    }`}
                  />
                  <span>
                    <span
                      className={`block text-sm font-medium ${active ? "text-white" : "text-slate-300"}`}
                    >
                      {opt.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {opt.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 字幕样式预设 */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-white">字幕样式预设</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SUBTITLE_PRESETS.map((p) => {
              const active = presetId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPresetId(p.id)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    active
                      ? "border-indigo-500/60 bg-indigo-500/10 shadow-glow"
                      : "border-white/10 bg-white/[0.03] hover:border-indigo-500/30"
                  }`}
                >
                  {/* 样式预览 */}
                  <span className="block rounded-lg bg-black/50 px-3 py-2.5 text-center">
                    <span
                      className="font-medium"
                      style={{ color: p.color, fontSize: `${Math.min(p.fontSize, 18)}px` }}
                    >
                      示例字幕 Aa
                    </span>
                  </span>
                  <span
                    className={`mt-2.5 block text-sm font-medium ${active ? "text-white" : "text-slate-300"}`}
                  >
                    {p.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {p.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 转场 + 音量 */}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-white">镜头转场</h2>
            <div className="mt-3 flex items-center gap-2">
              <select
                value={effectiveTransition}
                onChange={(e) => setTransition(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-slate-200 outline-none transition-colors focus:border-indigo-500/50"
              >
                {TRANSITION_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {aiRecommendedTransition === effectiveTransition && (
                <span className="shrink-0 rounded-full bg-indigo-500/15 px-2.5 py-1 text-[11px] text-indigo-300">
                  AI 推荐
                </span>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">
              BGM 音量{" "}
              <span className="tabular-nums text-indigo-300">
                {Math.round(volume * 100)}%
              </span>
            </h2>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              className="mt-5 w-full accent-indigo-500"
            />
          </div>
        </div>

        {/* 生成按钮 */}
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 py-3.5 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4Z" />
              </svg>
              正在生成并打包草稿…
            </>
          ) : (
            "生成草稿"
          )}
        </button>

        {genError && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
            {genError}
          </p>
        )}

        {/* 下载卡片 */}
        {result && (
          <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-emerald-300">
                  草稿已生成，下载已开始
                </p>
                <p className="mt-1 truncate text-xs text-slate-400">
                  {result.fileName} · {result.shotCount} 个镜头 ·{" "}
                  {result.subtitleCount} 条字幕 · 转场「{result.transition}」 ·{" "}
                  {result.aspectRatio}
                </p>
              </div>
              <a
                href={result.downloadUrl}
                download={result.fileName}
                className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-medium text-white shadow-glow transition-transform hover:scale-105 active:scale-95"
              >
                重新下载 zip
              </a>
            </div>
          </div>
        )}
      </div>

      <ImportGuide />
    </main>
  );
}
