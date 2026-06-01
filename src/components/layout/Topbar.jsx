import { Bell, Plus, Search, Wifi } from 'lucide-react';

const Topbar = ({ title, description }) => {
  return (
    <header className="sticky top-0 z-20 border-b border-[#edf1f5] bg-white/85 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1
            title={title}
            className="truncate text-xl font-semibold tracking-[-0.03em] text-[#1d1d1f] sm:text-2xl"
          >
            {title}
          </h1>

          {description ? (
            <p
              title={description}
              className="mt-1 hidden max-w-2xl truncate text-sm leading-6 text-[#6e6e73] sm:block"
            >
              {description}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden h-11 items-center gap-2 rounded-2xl border border-[#e8edf2] bg-[#f8fafc] px-4 transition focus-within:border-[#43acd6] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#43acd6]/10 xl:flex">
            <Search size={16} className="shrink-0 text-[#8e8e93]" />

            <input
              placeholder="Search ticket, customer..."
              className="w-56 bg-transparent text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
            />
          </div>

          <div className="hidden h-11 items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 lg:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <Wifi size={15} />
            Connected
          </div>

          <button
            type="button"
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8edf2] bg-white text-[#6e6e73] transition hover:-translate-y-0.5 hover:border-[#d8eef7] hover:bg-[#f7fbfd] hover:text-[#2389b8]"
            aria-label="Notifications"
          >
            <Bell size={18} />

            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white ring-2 ring-white">
              3
            </span>
          </button>

          <button
            type="button"
            className="hidden h-11 items-center justify-center gap-2 rounded-2xl bg-[#43acd6] px-4 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:-translate-y-0.5 hover:bg-[#2389b8] hover:shadow-[0_18px_36px_rgba(67,172,214,0.24)] sm:inline-flex"
          >
            <Plus size={16} />
            New Ticket
          </button>
        </div>
      </div>

      {description ? (
        <p
          title={description}
          className="mt-3 line-clamp-2 text-sm leading-6 text-[#6e6e73] sm:hidden"
        >
          {description}
        </p>
      ) : null}
    </header>
  );
};

export default Topbar;