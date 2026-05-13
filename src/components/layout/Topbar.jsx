import { Bell, Search, Wifi } from 'lucide-react';

const Topbar = ({ title, description }) => {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
            <Search size={16} className="text-slate-400" />
            <input
              placeholder="Search ticket, customer..."
              className="w-56 bg-transparent text-sm outline-none"
            />
          </div>

          <div className="hidden items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 lg:flex">
            <Wifi size={16} />
            Connected
          </div>

          <button className="relative rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-50">
            <Bell size={18} />
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
              3
            </span>
          </button>

          <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + New Ticket
          </button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;