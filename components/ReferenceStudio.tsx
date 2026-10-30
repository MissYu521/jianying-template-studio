"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MaterialUploader, {
  type MaterialItem,
} from "@/components/reference/MaterialUploader";
import ReferenceUploader from "@/components/reference/ReferenceUploader";
import ProgressPanel, { COMPOSE_STAGES } from "@/components/reference/ProgressPanel";
import { formatTime } from "@/lib/format";
import type { ComposeResponse, ComposeResultData } from "@/lib/types";

const ASPECT_OPTIONS = [
  { value: "9:16", label: "9:16 竖屏", desc: "抖音 / 视频号 / 快手" },
  { value: "16:9", label: "16:9 横屏", desc: "B站 / 西瓜 / 网页" },
] as const;

const SECTION =
  "glass-card rounded-2xl p-4 sm:p-6";
const SECTION_TITLE = "flex items-center gap-2 text-sm font-semibold text-white sm:text-base";

function SectionHeader({ index, title, extra }: { index: number; title: string; extra?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className={SECTION_TITLE}>
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-gradient text-xs font-bold text-white">
          {index}
        </span>
        {title}
      </h2>
      {extra && <span className="text-[11px] text-slate-500">{extra}</span>}
    </div>
  );
}

export default function ReferenceStudio() {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreviewUrl, setRefPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<string>("9:16");
  const [intensity, setIntensity] = useState(0.7);

  const [processing, setProcessing] = useState(false);
  const [stage, setStage] = useState(0);
  const [stageFailed, setStageFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComposeResultData | null>(null);

  // 参考片预览 URL 生命周期
  useEffect(() => {
    if (!refFile) {
      setRefPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(refFile);
    setRefPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [refFile]);

  // 处理中：按预估耗时推进阶段展示（真实阶段以后端返回的 stages 为准）
  useEffect(() => {
    if (!processing) return;
    setStage(0);
    const timers = [
      setTimeout(() => setStage(1), 8000),
      setTimeout(() => setStage(2), 22000),
      setTimeout(() => setStage(3), 30000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [processing]);

  const canStart =
    materials.length > 0 && refFile !== null && !processing;

  const start = useCallback(async () => {
    if (!canStart || !refFile) return;
    setProcessing(true);
    setStageFailed(false);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      materials.forEach((m) => fd.append("materials", m.file, m.name));
      fd.append("reference", refFile, refFile.name);
      fd.append("prompt", prompt);
      fd.append("aspectRatio", aspectRatio);
      fd.append("intensity", String(intensity));

      const res = await fetch("/api/reference/compose", {
        method: "POST",
        body: fd,
      });
      const json: ComposeResponse = await res.json();
      if (!json.ok) throw new Error(json.error);
      setResult(json.data);
      setStage(COMPOSE_STAGES.length); // 全部完成
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络异常，请检查连接后重试。");
      setStageFailed(true);
    } finally {
      setProcessing(false);
    }
  }, [canStart, refFile, materials, prompt, aspectRatio, intensity]);

  // 生成成功后自动触发下载
  useEffect(() => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.draft.downloadUrl;
    a.download = result.draft.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [result]);

  return (
    <div className="space-y-5">
      {/* 分区1：素材批量上传 */}
      <section className={SECTION}>
        <SectionHeader index={1} title="素材库" extra={`${materials.length}/20 个素材`} />
        <p className="mt-1.5 text-xs text-slate-500">
          批量上传视频 / 图片 / 音频素材，列表顺序即为成片中的出现顺序（可拖拽排序）。
        </p>
        <div className="mt-4">
          <MaterialUploader
            items={materials}
            onChange={setMaterials}
            onError={setError}
            disabled={processing}
          />
        </div>
      </section>

      {/* 分区2：参考样片 */}
      <section className={SECTION}>
        <SectionHeader index={2} title="参考样片" extra="仅限本地文件" />
        <p className="mt-1.5 text-xs text-slate-500">
          AI 将分析样片的镜头节奏、转场与风格，作为素材编排的参照范式。
        </p>
        <div className="mt-4">
          <ReferenceUploader
            file={refFile}
            previewUrl={refPreviewUrl}
            onSelect={setRefFile}
            onError={setError}
            disabled={processing}
          />
        </div>
      </section>

      {/* 分区3：剪辑提示词 */}
      <section className={SECTION}>
        <SectionHeader index={3} title="剪辑提示词" extra="可选" />
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={processing}
          rows={4}
          maxLength={1000}
          placeholder={"描述你的剪辑需求，例如：\n· 成片时长 30 秒左右，旅行 Vlog 风格\n· BGM 偏好：节奏感强的卡点电子乐\n· 字幕要求：底部白色黑体（或：不要字幕）\n· 节奏偏快，开头 3 秒要有冲击力"}
          className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 outline-none transition-colors focus:border-indigo-500/50 disabled:opacity-50"
        />
        <p className="mt-1.5 text-right text-[11px] text-slate-600">
          {prompt.length}/1000
        </p>
      </section>

      {/* 分区4：参数面板 */}
      <section className={SECTION}>
        <SectionHeader index={4} title="成片参数" />
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* 成片比例 */}
          <div>
            <p className="text-xs font-medium text-slate-400">成片比例</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {ASPECT_OPTIONS.map((opt) => {
                const active = aspectRatio === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={processing}
                    onClick={() => setAspectRatio(opt.value)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                      active
                        ? "border-indigo-500/60 bg-indigo-500/10 shadow-glow"
                        : "border-white/10 bg-white/[0.03] hover:border-indigo-500/30"
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`shrink-0 rounded border-2 ${
                        active ? "border-indigo-400" : "border-slate-600"
                      } ${opt.value === "9:16" ? "h-12 w-[27px]" : "h-[27px] w-12"}`}
                    />
                    <span>
                      <span className={`block text-xs font-medium ${active ? "text-white" : "text-slate-300"}`}>
                        {opt.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">
                        {opt.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 参考强度 */}
          <div>
            <p className="text-xs font-medium text-slate-400">
              参考强度{" "}
              <span className="tabular-nums text-indigo-300">
                {intensity.toFixed(2)}
              </span>
            </p>
            <input
              type="range"
              min={0.3}
              max={1.0}
              step={0.05}
              value={intensity}
              disabled={processing}
              onChange={(e) => setIntensity(Number(e.target.value))}
              className="mt-4 w-full accent-indigo-500 disabled:opacity-50"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-600">
              <span>0.3 · 保留素材原始节奏</span>
              <span>1.0 · 完全贴近参考节奏</span>
            </div>
          </div>
        </div>
      </section>

      {/* 开始按钮 */}
      <button
        type="button"
        onClick={start}
        disabled={!canStart}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 py-4 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {processing ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4Z" />
            </svg>
            正在分析与编排…
          </>
        ) : (
          "开始分析参考片并编排素材"
        )}
      </button>
      {!canStart && !processing && (
        <p className="-mt-2 text-center text-[11px] text-slate-600">
          请先添加至少 1 个素材并上传参考样片
        </p>
      )}

      {/* 进度面板 */}
      {(processing || stageFailed || result) && (
        <ProgressPanel
          current={stage}
          active={processing}
          failed={stageFailed && !processing}
        />
      )}

      {/* 错误提示 */}
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* 结果区 */}
      {result && (
        <div className="space-y-5">
          {/* 剪辑范式 */}
          <section className={SECTION}>
            <SectionHeader index={0} title="剪辑范式解析" extra={`模型参考强度 ${intensity.toFixed(2)}`} />
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[11px] text-slate-500">剪辑节奏</p>
                <p className="text-gradient mt-1 text-lg font-bold">{result.pattern.paceType}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  平均镜头 {result.pattern.avgShotDuration.toFixed(1)}s
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[11px] text-slate-500">主转场</p>
                <p className="mt-1 text-lg font-bold text-white">{result.pattern.transition}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[11px] text-slate-500">画面风格</p>
                <p className="mt-1 text-sm text-slate-200">{result.pattern.visualStyle}</p>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-slate-400">
              <p><span className="text-indigo-300">时长模式：</span>{result.pattern.durationPattern}</p>
              <p><span className="text-indigo-300">叙事结构：</span>{result.pattern.narrativeStructure}</p>
              <p><span className="text-indigo-300">BGM 建议：</span>{result.pattern.bgmSuggestion}</p>
            </div>
          </section>

          {/* 编排时间线 */}
          <section className={SECTION}>
            <SectionHeader index={0} title="素材编排结果" extra={`共 ${result.arrangement.length} 个片段 · ${formatTime(result.totalDuration)}`} />
            {/* 时间线条 */}
            <div className="mt-4 flex h-9 w-full overflow-hidden rounded-lg border border-white/10">
              {result.arrangement.map((a) => (
                <div
                  key={a.index}
                  title={`${a.fileName} · ${a.duration}s`}
                  style={{
                    width: `${(a.duration / result.totalDuration) * 100}%`,
                    minWidth: "3px",
                  }}
                  className={`h-full opacity-80 transition-opacity hover:opacity-100 ${
                    a.mediaType === "image"
                      ? "bg-gradient-to-b from-purple-500 to-fuchsia-500"
                      : "bg-gradient-to-b from-blue-500 to-indigo-500"
                  }`}
                />
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
              <span>00:00</span>
              <span>{formatTime(result.totalDuration)}</span>
            </div>
            {/* 片段列表 */}
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {result.arrangement.map((a) => (
                <li
                  key={a.index}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-gradient text-[11px] font-bold text-white">
                    {a.index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-white sm:text-sm">
                    {a.fileName}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                    {formatTime(a.start)} - {formatTime(a.end)}
                  </span>
                  <span className="shrink-0 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-indigo-300">
                    {a.duration.toFixed(1)}s
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* 草稿下载 */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-emerald-300">
                  CapCut 草稿已生成，下载已开始
                </p>
                <p className="mt-1 truncate text-xs text-slate-400">
                  {result.draft.fileName} · {result.draft.shotCount} 个片段 ·{" "}
                  {result.draft.subtitleCount} 条字幕 · {aspectRatio}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  草稿内为占位素材，导入剪映后按素材名替换为你的素材即可
                </p>
              </div>
              <a
                href={result.draft.downloadUrl}
                download={result.draft.fileName}
                className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-medium text-white shadow-glow transition-transform hover:scale-105 active:scale-95"
              >
                重新下载 zip
              </a>
            </div>
          </div>

          {/* 阶段耗时 */}
          <p className="text-center text-[11px] text-slate-600">
            {result.stages.map((s) => `${s.name} ${(s.elapsedMs / 1000).toFixed(1)}s`).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
