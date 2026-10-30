const STEPS = [
  {
    title: "下载并解压草稿",
    desc: "下载「剪映模板_xxx.zip」，解压得到同名草稿文件夹。",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    ),
  },
  {
    title: "放入剪映草稿目录",
    desc: "将草稿文件夹整个移动到剪映专业版的草稿目录（路径见下方）。",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
      />
    ),
  },
  {
    title: "在剪映中打开",
    desc: "打开剪映专业版，首页「本地草稿」中即可看到该模板。",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
      />
    ),
  },
  {
    title: "替换占位素材",
    desc: "草稿内为黑场视频与静音音频占位，替换为你的素材即可正式剪辑。",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    ),
  },
];

/** 剪映草稿导入图文教程（页面底部说明区） */
export default function ImportGuide() {
  return (
    <section className="mx-auto mt-12 w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="glass-card rounded-2xl p-5 sm:p-8">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white sm:text-lg">
          <span className="h-5 w-1 rounded-full bg-brand-gradient" />
          如何导入剪映专业版
        </h2>

        {/* 步骤 */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="relative rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gradient-soft text-indigo-300">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5"
                    stroke="currentColor"
                    strokeWidth={1.6}
                  >
                    {step.icon}
                  </svg>
                </span>
                <p className="text-sm font-medium text-white">
                  <span className="mr-1.5 text-indigo-400">{i + 1}.</span>
                  {step.title}
                </p>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-slate-400">
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        {/* 草稿目录路径 */}
        <div className="mt-5 rounded-xl bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-slate-300 sm:text-xs">
          <p className="mb-2 font-sans font-medium text-slate-400">
            剪映草稿目录路径：
          </p>
          <p className="break-all">
            <span className="font-sans font-medium text-indigo-300">
              Windows：
            </span>
            C:\Users\&lt;用户名&gt;\AppData\Local\JianyingPro\User
            Data\Projects\com.lveditor.draft
          </p>
          <p className="mt-2 break-all">
            <span className="font-sans font-medium text-indigo-300">
              macOS：
            </span>
            ~/Movies/JianyingPro Drafts
          </p>
          <p className="mt-1 break-all text-slate-500">
            （新版 macOS 剪映：~/Movies/JianyingPro/User
            Data/Projects/com.lveditor.draft）
          </p>
        </div>
      </div>
    </section>
  );
}
