const templates = [
  {
    title: "城市漫游 Vlog",
    category: "旅行记录",
    uses: "2.3w",
    ratio: "9:16",
    gradient: "from-blue-500/80 via-indigo-500/60 to-purple-600/80",
  },
  {
    title: "好物开箱测评",
    category: "电商种草",
    uses: "1.8w",
    ratio: "9:16",
    gradient: "from-indigo-500/80 via-purple-500/60 to-fuchsia-600/80",
  },
  {
    title: "知识干货卡点",
    category: "知识分享",
    uses: "1.5w",
    ratio: "16:9",
    gradient: "from-cyan-500/80 via-blue-500/60 to-indigo-600/80",
  },
  {
    title: "美食探店日记",
    category: "生活方式",
    uses: "1.2w",
    ratio: "9:16",
    gradient: "from-violet-500/80 via-purple-500/60 to-blue-600/80",
  },
  {
    title: "运动燃脂混剪",
    category: "运动健身",
    uses: "9.8k",
    ratio: "9:16",
    gradient: "from-blue-600/80 via-sky-500/60 to-indigo-500/80",
  },
  {
    title: "品牌宣传片头",
    category: "企业宣传",
    uses: "8.4k",
    ratio: "16:9",
    gradient: "from-purple-600/80 via-indigo-500/60 to-blue-500/80",
  },
];

export default function ShowcaseSection() {
  return (
    <section id="showcase" className="py-16 sm:py-20">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
            SHOWCASE
          </p>
          <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
            热门模板 <span className="text-gradient">示例</span>
          </h2>
          <p className="mt-4 max-w-xl text-sm text-slate-400 sm:text-base">
            由社区创作者上传视频后自动生成的高人气模板，可直接套用。
          </p>
        </div>
        <a
          href="#upload"
          className="hidden shrink-0 rounded-lg border border-indigo-500/30 px-4 py-2 text-sm text-indigo-300 transition-colors hover:bg-indigo-500/10 sm:inline-block"
        >
          生成我的模板 →
        </a>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5">
        {templates.map((tpl) => (
          <article
            key={tpl.title}
            className="glass-card group overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-glow"
          >
            {/* 封面占位 */}
            <div
              className={`relative aspect-video bg-gradient-to-br ${tpl.gradient}`}
            >
              <div className="absolute inset-0 bg-grid opacity-60" />
              <span className="absolute right-3 top-3 rounded-md bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                {tpl.ratio}
              </span>
              <span className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur transition-transform duration-300 group-hover:scale-110">
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="ml-0.5 h-5 w-5 text-white"
                >
                  <path d="M8 5.14v14l11-7-11-7Z" />
                </svg>
              </span>
            </div>

            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="truncate text-sm font-semibold text-white sm:text-base">
                  {tpl.title}
                </h3>
                <span className="shrink-0 rounded-full bg-indigo-500/15 px-2.5 py-1 text-[11px] text-indigo-300">
                  {tpl.category}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>{tpl.uses} 次使用</span>
                <button
                  type="button"
                  className="text-indigo-300 transition-colors hover:text-white"
                >
                  使用模板 →
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
