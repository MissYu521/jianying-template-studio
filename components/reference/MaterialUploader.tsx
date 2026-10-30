"use client";

import { useEffect, useRef, useState } from "react";

export interface MaterialItem {
  id: string;
  file: File;
  name: string;
  size: number;
  mediaType: "video" | "image" | "audio";
  previewUrl: string | null;
}

const MAX_SIZE_MB = 100;
const MAX_MATERIALS = 20;

const TYPE_BADGE = {
  video: { label: "视频", cls: "border-blue-500/30 bg-blue-500/15 text-blue-300" },
  image: { label: "图片", cls: "border-purple-500/30 bg-purple-500/15 text-purple-300" },
  audio: { label: "音频", cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" },
} as const;

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function mediaTypeOf(file: File): MaterialItem["mediaType"] | null {
  const t = file.type.toLowerCase();
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("audio/")) return "audio";
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if ([".mp4", ".mov", ".webm"].includes(ext)) return "video";
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return "image";
  if ([".mp3", ".wav", ".aac", ".m4a"].includes(ext)) return "audio";
  return null;
}

interface Props {
  items: MaterialItem[];
  onChange: (items: MaterialItem[]) => void;
  onError: (msg: string | null) => void;
  disabled?: boolean;
}

/** 分区1：批量素材上传 + 列表展示 + 拖拽排序（移动端用上/下移按钮） */
export default function MaterialUploader({ items, onChange, onError, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isDragOverZone, setIsDragOverZone] = useState(false);

  // 组件卸载时释放 objectURL
  useEffect(() => {
    return () => {
      items.forEach((m) => m.previewUrl && URL.revokeObjectURL(m.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (files: FileList | File[]) => {
    onError(null);
    const next = [...items];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_MATERIALS) {
        onError(`素材数量已达 ${MAX_MATERIALS} 个上限。`);
        break;
      }
      const mediaType = mediaTypeOf(file);
      if (!mediaType) {
        onError(`「${file.name}」格式不支持，仅接受视频 / 图片 / 音频。`);
        continue;
      }
      if (file.size === 0 || file.size > MAX_SIZE_MB * 1024 * 1024) {
        onError(`「${file.name}」为空或超过 ${MAX_SIZE_MB}MB 限制。`);
        continue;
      }
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        size: file.size,
        mediaType,
        previewUrl:
          mediaType === "audio" ? null : URL.createObjectURL(file),
      });
    }
    onChange(next);
  };

  const removeAt = (idx: number) => {
    const target = items[idx];
    if (target.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange(items.filter((_, i) => i !== idx));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div>
      {/* 上传区 */}
      <div
        role="button"
        tabIndex={0}
        aria-label="批量上传素材"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOverZone(true);
        }}
        onDragLeave={() => setIsDragOverZone(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOverZone(false);
          if (!disabled) addFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-all sm:py-10 ${
          isDragOverZone
            ? "border-indigo-400 bg-indigo-500/10 shadow-glow"
            : "border-white/10 bg-white/[0.02] hover:border-indigo-500/40 hover:bg-indigo-500/5"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient-soft">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-indigo-300" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </span>
        <p className="mt-3 text-sm font-medium text-white">
          点击选择或拖拽素材到此处
        </p>
        <p className="mt-1 text-xs text-slate-500">
          视频 / 图片 / 音频 · 单个 ≤{MAX_SIZE_MB}MB · 最多 {MAX_MATERIALS} 个
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="video/*,image/*,audio/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* 素材列表（拖拽排序） */}
      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((m, idx) => {
            const badge = TYPE_BADGE[m.mediaType];
            return (
              <li
                key={m.id}
                draggable={!disabled}
                onDragStart={() => (dragIndexRef.current = idx)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverIdx(idx);
                }}
                onDragLeave={() => setDragOverIdx((v) => (v === idx ? null : v))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverIdx(null);
                  const from = dragIndexRef.current;
                  if (from !== null) move(from, idx);
                  dragIndexRef.current = null;
                }}
                className={`flex items-center gap-3 rounded-xl border p-2.5 transition-all ${
                  dragOverIdx === idx
                    ? "border-indigo-400 bg-indigo-500/10"
                    : "border-white/10 bg-white/[0.03]"
                } ${disabled ? "opacity-60" : ""}`}
              >
                {/* 拖拽手柄（桌面端） */}
                <span
                  className="hidden cursor-grab text-slate-600 hover:text-slate-400 sm:block"
                  title="拖拽排序"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d="M8 5a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm0 7a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm0 7a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm6-14a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm0 7a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm0 7a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z" />
                  </svg>
                </span>

                {/* 序号 */}
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-gradient text-[11px] font-bold text-white">
                  {idx + 1}
                </span>

                {/* 缩略图 / 音频图标 */}
                {m.mediaType === "audio" ? (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-emerald-300">
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.6}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
                    </svg>
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.previewUrl ?? ""}
                    alt={m.name}
                    className="h-12 w-12 shrink-0 rounded-lg border border-white/10 bg-black/40 object-cover"
                  />
                )}

                {/* 名称与信息 */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-white sm:text-sm">
                    {m.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                    <span
                      className={`rounded-full border px-1.5 py-px text-[10px] ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    {formatSize(m.size)}
                  </p>
                </div>

                {/* 移动端排序按钮 */}
                <div className="flex shrink-0 flex-col sm:hidden">
                  <button
                    type="button"
                    aria-label="上移"
                    disabled={disabled || idx === 0}
                    onClick={() => move(idx, idx - 1)}
                    className="px-1.5 text-slate-400 disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="下移"
                    disabled={disabled || idx === items.length - 1}
                    onClick={() => move(idx, idx + 1)}
                    className="px-1.5 text-slate-400 disabled:opacity-30"
                  >
                    ▼
                  </button>
                </div>

                {/* 删除 */}
                <button
                  type="button"
                  aria-label="删除素材"
                  disabled={disabled}
                  onClick={() => removeAt(idx)}
                  className="shrink-0 rounded-lg border border-white/10 p-1.5 text-slate-500 transition-colors hover:border-red-500/40 hover:text-red-300 disabled:opacity-40"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 && (
        <p className="mt-2 text-[11px] text-slate-600">
          已添加 {items.length} 个素材 · 桌面端拖拽手柄排序，移动端用 ▲▼ 调整；顺序即成片中的出现顺序
        </p>
      )}
    </div>
  );
}
