import {
  BarChart3,
  CheckCircle,
  ClipboardList,
  Clock,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Send,
  Settings,
  ShieldCheck,
  Tags,
  Users,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const menuItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'All Tickets', path: '/tickets', icon: Inbox, count: 24 },
  { label: 'Chatbot (Website)', path: '/chatbot', icon: MessageCircle, count: 11 },
  { label: 'Telegram', path: '/telegram', icon: Send, count: 4 },
  { label: 'Walk-in / Manual', path: '/manual-ticket', icon: ClipboardList },
  { label: 'Waiting Queue', path: '/waiting-queue', icon: Clock, count: 5 },
  { label: 'Pending Investigation', path: '/pending-investigation', icon: ShieldCheck, count: 3 },
  { label: 'Closed Tickets', path: '/closed-tickets', icon: CheckCircle },
  { label: 'Agents', path: '/agents', icon: Users },
  { label: 'Categories', path: '/categories', icon: Tags },
  { label: 'Reports', path: '/reports', icon: BarChart3 },
  { label: 'Settings', path: '/settings', icon: Settings },
];

const Sidebar = () => {
  return (
    <aside className="fixed left-0 top-0 h-screen w-72 bg-slate-950 text-white">
      <div className="flex h-full flex-col">
        <div className="border-b border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-lg font-bold text-slate-950">
              $
            </div>
            <div>
              <div className="text-lg font-bold">T.A Coin</div>
              <div className="text-sm text-slate-400">Central Chat</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <span className="flex items-center gap-3">
                  <Icon size={18} />
                  {item.label}
                </span>

                {item.count ? (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                    {item.count}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 rounded-2xl bg-white/5 p-3">
            <div className="text-sm font-semibold">Agent Dara</div>
            <div className="text-xs text-slate-400">Customer Service Agent</div>
            <div className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Available
            </div>
          </div>

          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-300 hover:bg-red-500/10">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;