"use client";

import { useRef } from "react";

interface Props {
  file: File | null;
  previewUrl: string | null;
  onSelect: (file: File | null) => void;
  onError: (msg: string | null) => void;
  disabled?: boolean;
}

const MAX_SIZE_MB = 100;

/** 分区2：参考样片上传（仅限本地文件）+ 版权提示 */
export default function ReferenceUploader({ file, previewUrl, onSelect, onError, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = (f: File | undefined) => {
    onError(null);
    if (!f) return;
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    const isVideo =
      f.type.toLowerCase().startsWith("video/") ||
      [".mp4", ".mov", ".webm"].includes(ext);
    if (!isVideo) {
      onError("参考样片仅支持视频文件（MP4 / MOV / WebM）。");
      return;
    }
    if (f.size === 0 || f.size > MAX_SIZE_MB * 1024 * 1024) {
      onError(`参考样片为空或超过 ${MAX_SIZE_MB}MB 限制。`);
      return;
    }
    onSelect(f);
  };

  return (
    <div>
      {!file ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="上传参考样片"
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!disabled) acceptFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center transition-all hover:border-purple-500/40 hover:bg-purple-500/5 ${
            disabled ? "cursor-not-allowed opacity-50" : ""
          }`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/15">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-purple-300" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </span>
          <p className="mt-3 text-sm font-medium text-white">
            上传参考样片（本地视频文件）
          </p>
          <p className="mt-1 text-xs text-slate-500">
            MP4 / MOV / WebM · ≤{MAX_SIZE_MB}MB · 建议 3 分钟以内
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
          <div className="flex items-center justify-between gap-3 border-t border-white/10 p-3">
            <p className="min-w-0 truncate text-xs text-slate-300">{file.name}</p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(null)}
              className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-40"
            >
              重新选择
            </button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/*,.mp4,.mov,.webm"
        className="hidden"
        onChange={(e) => {
          acceptFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {/* 版权提示 */}
      <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-amber-200/90 sm:text-xs">
          <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span>
            <span className="font-semibold">版权提示：</span>
            本平台仅支持上传本地文件进行分析，不会也无法从网络爬取任何内容。
            请确保参考样片为您拥有合法使用权的素材；分析结果仅用于学习其剪辑手法，
            成片请使用您自己的素材导出，请勿侵犯他人著作权。
          </span>
        </p>
      </div>
    </div>
  );
}
