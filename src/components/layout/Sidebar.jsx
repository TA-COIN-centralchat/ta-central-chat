import { useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  Clock,
  Headphones,
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
import { NavLink, useNavigate } from 'react-router-dom';

import logo from '../../assets/logo.png';

import { getTickets } from '../../services/ticketService';
import { supabase } from '../../services/supabaseClient';
import {
  clearCurrentUser,
  getCurrentAgentId,
  getCurrentUserName,
  getCurrentUserRole,
} from '../../utils/authUtils';

const buildMenuGroups = (counts) => [
  {
    title: 'Overview',
    defaultOpen: true,
    items: [
      {
        label: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        roles: [
          'Admin',
          'Customer Service Agent',
          'Customer Support Agent',
        ],
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
        roles: [
          'Admin',
          'Customer Service Agent',
          'Customer Support Agent',
        ],
      },
      {
        label: 'Waiting Queue',
        path: '/waiting-queue',
        icon: Clock,
        count: counts.waitingQueue,
        roles: ['Admin'],
      },
      {
        label: 'Pending Investigation',
        path: '/investigation',
        icon: ShieldCheck,
        count: counts.pendingInvestigation,
        roles: [
          'Admin',
          'Customer Service Agent',
          'Customer Support Agent',
        ],
      },
      {
        label: 'Ready to Contact',
        path: '/ready-to-contact',
        icon: Send,
        count: counts.readyToContact,
        roles: [
          'Admin',
          'Customer Service Agent',
          'Customer Support Agent',
        ],
      },
      {
        label: 'Closed Tickets',
        path: '/closed',
        icon: CheckCircle,
        count: counts.closedTickets,
        roles: [
          'Admin',
          'Customer Service Agent',
          'Customer Support Agent',
        ],
      },
      {
        label: 'Walk-in / Manual',
        path: '/manual-ticket',
        icon: ClipboardList,
        roles: [
          'Admin',
          'Customer Service Agent',
          'Customer Support Agent',
        ],
      },
    ],
  },
  {
    title: 'Channels',
    defaultOpen: false,
    items: [
      {
        label: 'Live Chat',
        path: '/live-chat',
        icon: Headphones,
        count: counts.liveChatSessions,
        roles: [
          'Admin',
          'Customer Service Agent',
          'Customer Support Agent',
        ],
      },
      {
        label: 'Telegram Sessions',
        path: '/telegram',
        icon: Send,
        count: counts.telegramSessions,
        roles: [
          'Admin',
          'Customer Service Agent',
          'Customer Support Agent',
        ],
      },
      {
        label: 'Facebook Sessions',
        path: '/facebook',
        icon: MessageCircle,
        count: counts.facebookSessions,
        roles: [
          'Admin',
          'Customer Service Agent',
          'Customer Support Agent',
        ],
      },
      {
        label: 'WhatsApp Sessions',
        path: '/whatsapp',
        icon: MessageCircle,
        count: counts.whatsAppSessions,
        roles: ['Admin', 'Customer Service Agent', 'Customer Support Agent'],
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
        roles: [
          'Admin',
          'Customer Service Agent',
          'Customer Support Agent',
        ],
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

const isAdminRole = (role) => {
  const normalizedRole = String(role || '')
    .trim()
    .toLowerCase();

  return (
    normalizedRole === 'admin' ||
    normalizedRole === 'system admin'
  );
};

const isActiveSession = (session) => {
  const status = String(session?.status || '')
    .trim()
    .toLowerCase();

  return (
    status === 'active' ||
    status === 'idle warning'
  );
};

const sessionMatchesChannel = (
  session,
  channel,
) => {
  const metadata =
    session?.metadata &&
    typeof session.metadata === 'object'
      ? session.metadata
      : {};

  const value = [
    session?.channel,
    metadata.channel,
    metadata.source,
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');

  const target = String(channel || '')
    .trim()
    .toLowerCase();

  if (target === 'live chat') {
    return (
      value.includes('live chat') ||
      value.includes('website chatbot') ||
      value.includes('website chat') ||
      value.includes('chatbot')
    );
  }

  if (target === 'telegram') {
    return value.includes('telegram');
  }

  if (target === 'facebook') {
    return value.includes('facebook');
  }

  if (target === 'whatsapp') {
    return (
      value.includes('whatsapp') ||
      value.includes('whats app')
    );
  }

  return value.includes(target);
};

const Sidebar = ({
  open = false,
  onClose,
}) => {
  const navigate = useNavigate();

  const currentUserRole =
    getCurrentUserRole();

  const currentUserName =
    getCurrentUserName();

  const currentAgentId =
    getCurrentAgentId();

  const [counts, setCounts] =
    useState({
      allTickets: 0,
      waitingQueue: 0,
      pendingInvestigation: 0,
      readyToContact: 0,
      closedTickets: 0,
      liveChatSessions: 0,
      telegramSessions: 0,
      facebookSessions: 0,
      whatsAppSessions: 0,
    });

  const [
    openGroups,
    setOpenGroups,
  ] = useState({
    Overview: true,
    Tickets: true,
    Channels: false,
    Management: false,
  });

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const tickets =
          await getTickets();

        let sessionQuery =
          supabase
            .from('chat_sessions')
            .select(
              'id, channel, status, assigned_agent_id, agent_id, metadata',
            );

        // Admin sees all active sessions. Agents only see/count sessions
        // assigned to them, matching the channel inbox access rule.
        if (
          !isAdminRole(
            currentUserRole,
          )
        ) {
          if (!currentAgentId) {
            setCounts((previous) => ({
              ...previous,

              allTickets:
                tickets.length,

              waitingQueue:
                tickets.filter(
                  (ticket) => {
                    const status =
                      ticket.status
                        ?.toLowerCase()
                        .trim();

                    return (
                      status ===
                        'new' ||
                      status ===
                        'waiting queue' ||
                      ticket.assignedTo ===
                        'Unassigned'
                    );
                  },
                ).length,

              pendingInvestigation:
                tickets.filter(
                  (ticket) => {
                    const status =
                      ticket.status
                        ?.toLowerCase()
                        .trim();

                    return (
                      status ===
                        'pending investigation' ||
                      status ===
                        'pending review' ||
                      status ===
                        'investigation' ||
                      status ===
                        'under investigation'
                    );
                  },
                ).length,

              readyToContact:
                tickets.filter(
                  (ticket) => {
                    const status =
                      ticket.status
                        ?.toLowerCase()
                        .trim();

                    return (
                      status ===
                        'ready to contact' ||
                      status ===
                        'ready-to-contact'
                    );
                  },
                ).length,

              closedTickets:
                tickets.filter(
                  (ticket) => {
                    const status =
                      ticket.status
                        ?.toLowerCase()
                        .trim();

                    return (
                      status ===
                        'closed' ||
                      status ===
                        'resolved' ||
                      status ===
                        'completed'
                    );
                  },
                ).length,

              liveChatSessions: 0,
              telegramSessions: 0,
              facebookSessions: 0,
              whatsAppSessions: 0,
            }));

            return;
          }

          sessionQuery =
            sessionQuery.or(
              `assigned_agent_id.eq.${currentAgentId},agent_id.eq.${currentAgentId}`,
            );
        }

        const {
          data: sessions,
          error: sessionsError,
        } = await sessionQuery;

        if (sessionsError) {
          throw sessionsError;
        }

        const activeSessions =
          (sessions || []).filter(
            isActiveSession,
          );

        setCounts({
          allTickets:
            tickets.length,

          waitingQueue:
            tickets.filter(
              (ticket) => {
                const status =
                  ticket.status
                    ?.toLowerCase()
                    .trim();

                return (
                  status === 'new' ||
                  status ===
                    'waiting queue' ||
                  ticket.assignedTo ===
                    'Unassigned'
                );
              },
            ).length,

          pendingInvestigation:
            tickets.filter(
              (ticket) => {
                const status =
                  ticket.status
                    ?.toLowerCase()
                    .trim();

                return (
                  status ===
                    'pending investigation' ||
                  status ===
                    'pending review' ||
                  status ===
                    'investigation' ||
                  status ===
                    'under investigation'
                );
              },
            ).length,

          readyToContact:
            tickets.filter(
              (ticket) => {
                const status =
                  ticket.status
                    ?.toLowerCase()
                    .trim();

                return (
                  status ===
                    'ready to contact' ||
                  status ===
                    'ready-to-contact'
                );
              },
            ).length,

          closedTickets:
            tickets.filter(
              (ticket) => {
                const status =
                  ticket.status
                    ?.toLowerCase()
                    .trim();

                return (
                  status ===
                    'closed' ||
                  status ===
                    'resolved' ||
                  status ===
                    'completed'
                );
              },
            ).length,

          liveChatSessions:
            activeSessions.filter(
              (session) =>
                sessionMatchesChannel(
                  session,
                  'Live Chat',
                ),
            ).length,

          telegramSessions:
            activeSessions.filter(
              (session) =>
                sessionMatchesChannel(
                  session,
                  'Telegram',
                ),
            ).length,

          facebookSessions:
            activeSessions.filter(
              (session) =>
                sessionMatchesChannel(
                  session,
                  'Facebook',
                ),
            ).length,

          whatsAppSessions:
            activeSessions.filter(
              (session) =>
                sessionMatchesChannel(
                  session,
                  'WhatsApp',
                ),
            ).length,
        });
      } catch (error) {
        console.error(
          'Failed to load sidebar counts:',
          error,
        );
      }
    };

    loadCounts();

    const ticketsSub =
      supabase
        .channel(
          'sidebar-tickets-realtime',
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tickets',
          },
          () => loadCounts(),
        )
        .subscribe();

    const sessionsSub =
      supabase
        .channel(
          'sidebar-sessions-realtime',
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              'chat_sessions',
          },
          () => loadCounts(),
        )
        .subscribe();

    return () => {
      ticketsSub.unsubscribe();
      sessionsSub.unsubscribe();
    };
  }, [
    currentAgentId,
    currentUserRole,
  ]);

  const canAccess = (
    allowedRoles,
  ) => {
    return allowedRoles.includes(
      currentUserRole,
    );
  };

  const menuGroups =
    buildMenuGroups(counts)
      .map((group) => ({
        ...group,
        items:
          group.items.filter(
            (item) =>
              canAccess(
                item.roles,
              ),
          ),
      }))
      .filter(
        (group) =>
          group.items.length > 0,
      );

  const toggleGroup = (
    title,
  ) => {
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

  const handleLogout =
    async () => {
      try {
        if (currentAgentId) {
          await supabase
            .from('agents')
            .update({
              status: 'Offline',
            })
            .eq(
              'id',
              currentAgentId,
            );
        }

        await supabase.auth.signOut();

        clearCurrentUser();

        navigate('/login', {
          replace: true,
        });
      } catch (error) {
        console.error(
          'Logout failed:',
          error,
        );

        clearCurrentUser();

        navigate('/login', {
          replace: true,
        });
      }
    };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-72 border-r border-black/6 dark:border-white/10 bg-white/88 dark:bg-[#1d1d1f]/88 text-[#1d1d1f] dark:text-[#f5f5f7] shadow-[18px_0_60px_rgba(0,0,0,0.06)] dark:shadow-[18px_0_60px_rgba(0,0,0,0.3)] backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0 ${
          open
            ? 'translate-x-0'
            : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-black/6 dark:border-white/10 px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={logo}
                  alt="T.A Coin Logo"
                  className="h-12 w-12 shrink-0 object-contain"
                />

                <div className="min-w-0">
                  <div className="truncate text-[17px] font-semibold tracking-[-0.03em] text-[#1d1d1f] dark:text-[#f5f5f7]">
                    T.A Coin
                  </div>

                  <div className="text-xs font-normal text-[#6e6e73] dark:text-[#a1a1a6]">
                    Central Chat
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-2xl text-[#8e8e93] dark:text-[#a1a1a6] transition hover:bg-[#f5f5f7] dark:hover:bg-white/10 hover:text-[#1d1d1f] dark:hover:text-white lg:hidden"
                aria-label="Close sidebar"
              >
                <X
                  size={18}
                  strokeWidth={1.8}
                />
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="mb-5 rounded-[22px] border border-black/6 dark:border-white/10 bg-[#f5f5f7] dark:bg-white/5 px-4 py-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8e8e93] dark:text-[#a1a1a6]">
                Current Role
              </div>

              <div className="mt-1 truncate text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                {currentUserRole ||
                  'No role'}
              </div>
            </div>

            <div className="space-y-4">
              {menuGroups.map(
                (group) => (
                  <div
                    key={
                      group.title
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        toggleGroup(
                          group.title,
                        )
                      }
                      className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8e8e93] dark:text-[#a1a1a6] transition hover:bg-[#f5f5f7] dark:hover:bg-white/10 hover:text-[#1d1d1f] dark:hover:text-white"
                    >
                      <span>
                        {
                          group.title
                        }
                      </span>

                      <ChevronDown
                        size={15}
                        strokeWidth={
                          1.8
                        }
                        className={`transition-transform ${
                          openGroups[
                            group
                              .title
                          ]
                            ? 'rotate-180'
                            : ''
                        }`}
                      />
                    </button>

                    {openGroups[
                      group.title
                    ] && (
                      <div className="mt-1 space-y-1">
                        {group.items.map(
                          (item) => {
                            const Icon =
                              item.icon;

                            return (
                              <NavLink
                                key={
                                  item.path
                                }
                                to={
                                  item.path
                                }
                                onClick={
                                  handleNavClick
                                }
                                className={({
                                  isActive,
                                }) =>
                                  `group flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                                    isActive
                                      ? 'bg-[#43acd6] text-white shadow-[0_12px_28px_rgba(67,172,214,0.24)]'
                                      : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:bg-[#f5f5f7] dark:hover:bg-white/10 hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
                                  }`
                                }
                              >
                                {({
                                  isActive,
                                }) => (
                                  <>
                                    <span className="flex min-w-0 items-center gap-3">
                                      <span
                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                                          isActive
                                            ? 'bg-white/18 text-white'
                                            : 'bg-white dark:bg-white/10 text-[#8e8e93] dark:text-[#a1a1a6] ring-1 ring-black/6 dark:ring-white/10 group-hover:text-[#1d1d1f] dark:group-hover:text-[#f5f5f7]'
                                        }`}
                                      >
                                        <Icon
                                          size={
                                            17
                                          }
                                          strokeWidth={
                                            1.8
                                          }
                                        />
                                      </span>

                                      <span className="truncate">
                                        {
                                          item.label
                                        }
                                      </span>
                                    </span>

                                    {typeof item.count ===
                                      'number' &&
                                    item.count >
                                      0 ? (
                                      <span
                                        className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                          isActive
                                            ? 'bg-white/20 text-white'
                                            : 'bg-[#eef9fd] dark:bg-[#43acd6]/20 text-[#2389b8] dark:text-[#43acd6]'
                                        }`}
                                      >
                                        {
                                          item.count
                                        }
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </NavLink>
                            );
                          },
                        )}
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          </nav>

          <div className="border-t border-black/6 dark:border-white/10 p-4">
            <div className="mb-3 rounded-3xl border border-black/6 dark:border-white/10 bg-[#f5f5f7] dark:bg-white/5 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#43acd6] text-sm font-semibold text-white">
                  {currentUserName
                    ?.charAt(0)
                    ?.toUpperCase() ||
                    'A'}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {currentUserName ||
                      'Unknown User'}
                  </div>

                  <div className="truncate text-xs text-[#6e6e73] dark:text-[#a1a1a6]">
                    {currentUserRole ||
                      'No role'}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Available
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <LogOut
                size={18}
                strokeWidth={1.8}
              />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;