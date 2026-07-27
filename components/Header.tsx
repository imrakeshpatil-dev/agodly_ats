export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="w-full max-w-xl">
          <label htmlFor="global-search" className="sr-only">
            Search
          </label>
          <input
            id="global-search"
            type="search"
            placeholder="Search candidates, clients, jobs..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Notifications"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
              <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
            </svg>
          </button>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white shadow-sm">
            RP
          </div>
        </div>
      </div>
    </header>
  );
}
