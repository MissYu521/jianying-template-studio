export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5 text-white"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </span>
          <span className="text-base font-semibold text-white sm:text-lg">
            剪映模板工坊
          </span>
        </a>

        <nav className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
          <a href="/#upload" className="transition-colors hover:text-white">
            上传创作
          </a>
          <a href="/#features" className="transition-colors hover:text-white">
            功能特性
          </a>
          <a href="/#showcase" className="transition-colors hover:text-white">
            模板示例
          </a>
        </nav>

        <a
          href="/#upload"
          className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-glow transition-transform hover:scale-105 active:scale-95"
        >
          开始创作
        </a>
      </div>
    </header>
  );
}
