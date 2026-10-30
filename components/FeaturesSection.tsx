const features = [
  {
    title: "AI 智能分析",
    description:
      "基于豆包大模型深度解析视频内容、画面节奏与音频节拍，精准定位高光片段。",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"
      />
    ),
  },
  {
    title: "模板自动生成",
    description:
      "将剪辑思路沉淀为结构化模板，转场、特效、字幕样式一键复用到新素材。",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3"
      />
    ),
  },
  {
    title: "字幕音乐匹配",
    description:
      "自动识别语音生成字幕，并按情绪与节奏智能匹配背景音乐与卡点位置。",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"
      />
    ),
  },
  {
    title: "多平台适配",
    description:
      "一键导出 9:16、16:9、1:1 等多种画幅比例，适配抖音、B站、视频号等平台。",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
      />
    ),
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-16 sm:py-20">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
          FEATURES
        </p>
        <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
          从素材到模板，<span className="text-gradient">一步到位</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm text-slate-400 sm:text-base">
          完整的 AI 视频模板工作流，覆盖分析、生成、匹配与导出的每个环节。
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="glass-card group rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-glow"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient-soft transition-transform duration-300 group-hover:scale-110">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6 text-indigo-300"
                stroke="currentColor"
                strokeWidth={1.6}
              >
                {feature.icon}
              </svg>
            </span>
            <h3 className="mt-5 text-base font-semibold text-white">
              {feature.title}
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
