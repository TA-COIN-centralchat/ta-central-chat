import { Bell, Menu, Plus, Search, Wifi } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';

const DashboardLayout = ({ title, description, children }) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-20 items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
              >
                <Menu size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-slate-950 sm:text-2xl">
                  {title}
                </h1>

                {description && (
                  <p className="mt-1 hidden truncate text-sm text-slate-500 sm:block">
                    {description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 xl:flex">
                <Search size={16} className="text-slate-400" />
                <input
                  placeholder="Search ticket, customer..."
                  className="w-56 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="hidden items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 sm:inline-flex">
                <Wifi size={16} />
                Connected
              </div>

              <button
                type="button"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                <Bell size={18} />
                <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                  3
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/manual-ticket')}
                className="hidden items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:inline-flex"
              >
                <Plus size={16} />
                New Ticket
              </button>
            </div>
          </div>

          {description && (
            <div className="border-t border-slate-100 px-4 pb-4 text-sm text-slate-500 sm:hidden">
              {description}
            </div>
          )}
        </header>

        <section className="max-w-full overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="min-w-0">{children}</div>
        </section>
      </main>
    </div>
  );
};

export default DashboardLayout;