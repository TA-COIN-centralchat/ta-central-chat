import { Bell, Menu, Plus, Search, Wifi } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useNotifications } from "../../context/NotificationContext";
import { useLayout } from "../../context/LayoutContext";

const severityStyles = {
  info: "border-sky-200 bg-sky-50 text-sky-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-800",
};

const DashboardLayout = ({ children, title: propTitle, description: propDescription }) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { notifications, unreadCount, panelOpen, setPanelOpen, markAllRead } =
    useNotifications();
  const { title, description, setTitle, setDescription } = useLayout();

  useEffect(() => {
    if (propTitle !== undefined) setTitle(propTitle);
    if (propDescription !== undefined) setDescription(propDescription);
  }, [propTitle, propDescription, setTitle, setDescription]);

  if (children) {
    return <>{children}</>;
  }

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
              <div className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-shadow xl:flex">
                <Search size={16} className="text-slate-400" />
                <input
                  placeholder="Search ticket, customer..."
                  className="w-56 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="hidden h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 sm:inline-flex">
                <Wifi size={16} />
                Connected
              </div>

              <button
                type="button"
                onClick={() => setPanelOpen(!panelOpen)}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate("/manual-ticket")}
                className="hidden h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 sm:inline-flex"
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

          {panelOpen && (
            <div className="absolute right-4 top-full z-40 mt-2 w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:right-6 lg:right-8">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-sm font-semibold text-slate-900">
                  Notifications
                </p>
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Mark all read
                </button>
              </div>

              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {notifications.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                    No notifications yet.
                  </p>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.link) navigate(item.link);
                        setPanelOpen(false);
                      }}
                      className={`w-full rounded-xl border p-3 text-left transition hover:bg-slate-50 ${
                        item.read
                          ? "border-slate-200 bg-white"
                          : "border-blue-200 bg-blue-50/30"
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">{item.body}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </header>

        <section className="max-w-full overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="min-w-0"><Outlet /></div>
        </section>

        <div className="pointer-events-none fixed bottom-4 right-4 z-50 space-y-2">
          {notifications
            .filter((item) => !item.read)
            .slice(0, 3)
            .map((item) => (
              <div
                key={item.id}
                className={`max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${
                  severityStyles[item.severity] ||
                  "border-slate-200 bg-white text-slate-800"
                }`}
              >
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-xs opacity-90">{item.body}</p>
              </div>
            ))}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
