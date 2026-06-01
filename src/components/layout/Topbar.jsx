import { Bell, Plus, Search, Wifi } from 'lucide-react';

const Topbar = ({ title, description }) => {
  return (
    <header className="sticky top-0 z-20 border-b border-[#edf1f5] dark:border-white/10 bg-white/85 dark:bg-[#1d1d1f]/85 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1
            title={title}
            className="truncate text-xl font-semibold tracking-[-0.03em] text-[#1d1d1f] dark:text-[#f5f5f7] sm:text-2xl"
          >
            {title}
          </h1>

          {description ? (
            <p
              title={description}
              className="mt-1 hidden max-w-2xl truncate text-sm leading-6 text-[#6e6e73] dark:text-[#a1a1a6] sm:block"
            >
              {description}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden h-11 items-center gap-2 rounded-2xl border border-[#e8edf2] dark:border-white/10 bg-[#f8fafc] dark:bg-white/5 px-4 transition focus-within:border-[#43acd6] dark:focus-within:border-[#43acd6] focus-within:bg-white dark:focus-within:bg-white/10 focus-within:ring-4 focus-within:ring-[#43acd6]/10 xl:flex">
            <Search size={16} className="shrink-0 text-[#8e8e93] dark:text-[#a1a1a6]" />

            <input
              placeholder="Search ticket, customer..."
              className="w-56 bg-transparent text-sm text-[#1d1d1f] dark:text-[#f5f5f7] outline-none placeholder:text-[#8e8e93] dark:placeholder:text-[#a1a1a6]"
            />
          </div>

          <div className="hidden h-11 items-center gap-2 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-4 text-sm font-medium text-emerald-700 dark:text-emerald-400 lg:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <Wifi size={15} />
            Connected
          </div>

          <button
            type="button"
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8edf2] dark:border-white/10 bg-white dark:bg-white/5 text-[#6e6e73] dark:text-[#a1a1a6] transition hover:-translate-y-0.5 hover:border-[#d8eef7] dark:hover:border-[#43acd6]/30 hover:bg-[#f7fbfd] dark:hover:bg-[#43acd6]/10 hover:text-[#2389b8] dark:hover:text-[#43acd6]"
            aria-label="Notifications"
          >
            <Bell size={18} />

            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-[#1d1d1f]">
              3
            </span>
          </button>

          <button
            type="button"
            className="hidden h-11 items-center justify-center gap-2 rounded-2xl bg-[#43acd6] px-4 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] dark:shadow-[0_14px_28px_rgba(67,172,214,0.3)] transition hover:-translate-y-0.5 hover:bg-[#2389b8] dark:hover:bg-[#52bce8] hover:shadow-[0_18px_36px_rgba(67,172,214,0.24)] sm:inline-flex"
          >
            <Plus size={16} />
            New Ticket
          </button>
        </div>
      </div>

      {description ? (
        <p
          title={description}
          className="mt-3 line-clamp-2 text-sm leading-6 text-[#6e6e73] dark:text-[#a1a1a6] sm:hidden"
        >
          {description}
        </p>
      ) : null}
    </header>
  );
};

export default Topbar;