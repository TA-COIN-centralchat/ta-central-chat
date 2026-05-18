import { useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle,
  ChevronDown,
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
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { getTickets } from '../../services/ticketService';

const currentUserRole = 'Admin';

/*
  Role access plan:

  Admin
  → full access

  Customer Service Agent
  → daily ticket handling, channels, manual ticket, queue, customers

  Customer Support Agent
  → investigation/support-focused work
*/

const canAccess = (allowedRoles) => {
  return allowedRoles.includes(currentUserRole);
};

const buildMenuGroups = (counts) => [
  {
    title: 'Overview',
    defaultOpen: true,
    items: [
      {
        label: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        roles: ['Admin', 'Customer Service Agent', 'Customer Support Agent'],
      },
      {
        label: 'Reports',
        path: '/reports',
        icon: BarChart3,
        roles: ['Admin'],
      },
      {
        label: 'Audit Logs',
        path: '/audit-logs',
        icon: ShieldCheck,
        roles: ['Admin'],
      },
    ],
  },
  {
    title: 'Tickets',
    defaultOpen: true,
    items: [
      {
        label: 'All Tickets',
        path: '/tickets',
        icon: Inbox,
        count: counts.allTickets,
        roles: ['Admin', 'Customer Service Agent', 'Customer Support Agent'],
      },
      {
        label: 'Waiting Queue',
        path: '/waiting-queue',
        icon: Clock,
        count: counts.waitingQueue,
        roles: ['Admin', 'Customer Service Agent'],
      },
      {
        label: 'Pending Investigation',
        path: '/pending-investigation',
        icon: ShieldCheck,
        count: counts.pendingInvestigation,
        roles: ['Admin', 'Customer Support Agent'],
      },
      {
        label: 'Closed Tickets',
        path: '/closed-tickets',
        icon: CheckCircle,
        roles: ['Admin', 'Customer Service Agent', 'Customer Support Agent'],
      },
      {
        label: 'Walk-in / Manual',
        path: '/manual-ticket',
        icon: ClipboardList,
        roles: ['Admin', 'Customer Service Agent'],
      },
    ],
  },
  {
    title: 'Channels',
    defaultOpen: false,
    items: [
      {
        label: 'Chatbot (Website)',
        path: '/chatbot',
        icon: MessageCircle,
        count: counts.websiteChatbot,
        roles: ['Admin', 'Customer Service Agent'],
      },
      {
        label: 'Telegram',
        path: '/telegram',
        icon: Send,
        count: counts.telegram,
        roles: ['Admin', 'Customer Service Agent'],
      },
    ],
  },
  {
    title: 'Management',
    defaultOpen: false,
    items: [
      {
        label: 'Customers',
        path: '/customers',
        icon: Users,
        roles: ['Admin', 'Customer Service Agent', 'Customer Support Agent'],
      },
      {
        label: 'Agents',
        path: '/agents',
        icon: Users,
        roles: ['Admin'],
      },
      {
        label: 'Categories',
        path: '/categories',
        icon: Tags,
        roles: ['Admin'],
      },
      {
        label: 'Settings',
        path: '/settings',
        icon: Settings,
        roles: ['Admin'],
      },
    ],
  },
];

const Sidebar = ({ open = false, onClose }) => {
  const [counts, setCounts] = useState({
    allTickets: 0,
    waitingQueue: 0,
    pendingInvestigation: 0,
    websiteChatbot: 0,
    telegram: 0,
  });

  const [openGroups, setOpenGroups] = useState({
    Overview: true,
    Tickets: true,
    Channels: false,
    Management: false,
  });

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const tickets = await getTickets();

        setCounts({
          allTickets: tickets.length,
          waitingQueue: tickets.filter(
            (ticket) =>
              ticket.status === 'New' || ticket.assignedTo === 'Unassigned'
          ).length,
          pendingInvestigation: tickets.filter(
            (ticket) => ticket.status === 'Pending Investigation'
          ).length,
          websiteChatbot: tickets.filter(
            (ticket) => ticket.channel === 'Website Chatbot'
          ).length,
          telegram: tickets.filter((ticket) => ticket.channel === 'Telegram')
            .length,
        });
      } catch (error) {
        console.error('Failed to load sidebar counts:', error);
      }
    };

    loadCounts();
  }, []);

  const menuGroups = buildMenuGroups(counts)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccess(item.roles)),
    }))
    .filter((group) => group.items.length > 0);

  const toggleGroup = (title) => {
    setOpenGroups((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const handleNavClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-72 bg-slate-950 text-white transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-lg font-bold text-slate-950">
                  $
                </div>

                <div>
                  <div className="text-lg font-bold">T.A Coin</div>
                  <div className="text-sm text-slate-400">Central Chat</div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="mb-4 rounded-2xl bg-white/5 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Current Role
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {currentUserRole}
              </div>
            </div>

            <div className="space-y-3">
              {menuGroups.map((group) => (
                <div key={group.title}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  >
                    <span>{group.title}</span>

                    <ChevronDown
                      size={16}
                      className={`transition-transform ${
                        openGroups[group.title] ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openGroups[group.title] && (
                    <div className="mt-1 space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;

                        return (
                          <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={handleNavClick}
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

                            {typeof item.count === 'number' && item.count > 0 ? (
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                                {item.count}
                              </span>
                            ) : null}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="mb-3 rounded-2xl bg-white/5 p-3">
              <div className="text-sm font-semibold">Agent Dara</div>
              <div className="text-xs text-slate-400">{currentUserRole}</div>
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
    </>
  );
};

export default Sidebar;