"use client";

export const COMPOSE_STAGES = [
  "抽帧参考片",
  "解析剪辑范式",
  "匹配素材",
  "生成 CapCut 草稿",
];

interface Props {
  /** 当前进行到的步骤下标（0-based）；全部完成时为 STAGES.length */
  current: number;
  /** 是否处理中 */
  active: boolean;
  /** 失败时的提示（当前步骤标红） */
  failed?: boolean;
}

/** 四阶段进度面板：抽帧参考片 → 解析剪辑范式 → 匹配素材 → 生成草稿 */
export default function ProgressPanel({ current, active, failed }: Props) {
  return (
    <div className="glass-card mt-6 rounded-2xl p-4 sm:p-5">
      <ol className="space-y-3">
        {COMPOSE_STAGES.map((name, i) => {
          const done = i < current;
          const running = i === current && active;
          const isFailed = i === current && failed;
          return (
            <li key={name} className="flex items-center gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-all ${
                  done
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                    : running
                      ? "border-indigo-400/60 bg-indigo-500/15 text-indigo-300"
                      : isFailed
                        ? "border-red-500/50 bg-red-500/15 text-red-300"
                        : "border-white/10 bg-white/[0.03] text-slate-600"
                }`}
              >
                {done ? (
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : running ? (
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4Z" />
                  </svg>
                ) : isFailed ? (
                  "✕"
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`text-sm ${
                  done
                    ? "text-slate-400"
                    : running
                      ? "font-medium text-white"
                      : isFailed
                        ? "text-red-300"
                        : "text-slate-600"
                }`}
              >
                {name}
                {running && "…"}
              </span>
              {running && (
                <span className="ml-auto h-1 w-24 overflow-hidden rounded-full bg-white/5 sm:w-40">
                  <span className="block h-full w-1/3 animate-[progress_1.6s_ease-in-out_infinite] rounded-full bg-brand-gradient" />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
