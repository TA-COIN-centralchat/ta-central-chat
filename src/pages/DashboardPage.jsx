import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Inbox,
  Loader2,
  MessageCircle,
  Send,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import DashboardLayout from '../components/layout/DashboardLayout';
import { getAgents, getTickets } from '../services/ticketService';
import { supabase } from '../services/supabaseClient';
import { getCurrentUserRole } from '../utils/authUtils';

const DashboardPage = () => {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    // Fetch tickets and agents independently so one failure doesn't blank
    // the entire dashboard. Using allSettled lets each state update from
    // its own resolved value instead of throwing out of Promise.all.
    const [ticketResult, agentResult] = await Promise.allSettled([
      getTickets(),
      getAgents(),
    ]);

    if (ticketResult.status === 'fulfilled') {
      setTickets(ticketResult.value);
    } else {
      console.error('Failed to load dashboard tickets:', ticketResult.reason);
    }

    if (agentResult.status === 'fulfilled') {
      setAgents(agentResult.value);
    } else {
      console.error('Failed to load dashboard agents:', agentResult.reason);
    }

    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) return;
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        loadDashboard({ silent: true });
      }, 500);
    };

    const ticketChannel = supabase
      .channel('dashboard-tickets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        scheduleRefresh
      )
      .subscribe();

    const sessionChannel = supabase
      .channel('dashboard-chat-sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_sessions' },
        scheduleRefresh
      )
      .subscribe();

    const agentChannel = supabase
      .channel('dashboard-agents')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agents' },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_presence' },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      ticketChannel.unsubscribe();
      sessionChannel.unsubscribe();
      agentChannel.unsubscribe();
    };
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const waitingQueue = tickets.filter(
      (ticket) => ticket.status === 'New' || ticket.assignedTo === 'Unassigned'
    ).length;

    const pendingInvestigation = tickets.filter(
      (ticket) => ticket.status === 'Pending Investigation'
    ).length;

    const closedTickets = tickets.filter(
      (ticket) => ticket.status === 'Resolved' || ticket.status === 'Closed'
    ).length;

    const telegramTickets = tickets.filter(
      (ticket) => ticket.channel === 'Telegram'
    ).length;

    const chatbotTickets = tickets.filter(
      (ticket) => ticket.channel === 'Website Chatbot'
    ).length;

    const availableAgents = agents.filter(
      (agent) =>
        agent.status === 'Available' && agent.role !== 'Admin'
    ).length;

    return {
      totalTickets: tickets.length,
      waitingQueue,
      pendingInvestigation,
      closedTickets,
      telegramTickets,
      chatbotTickets,
      totalAgents: agents.length,
      availableAgents,
    };
  }, [tickets, agents]);

  // Role-driven card visibility. Per product spec:
  //   Admin  → All Tickets, Waiting Queue, Pending Investigation, Agents,
  //            Agent Status panel
  //   Agent  → All Tickets, Pending Investigation, Closed/Resolved, Telegram,
  //            Website Chatbot
  // Routes here must match AppRoutes.
  const isAdmin = getCurrentUserRole() === 'Admin';

  const cardAllTickets = {
    title: 'All Tickets',
    value: stats.totalTickets,
    description: 'All support records',
    icon: Inbox,
    path: '/tickets',
    sparkline: true,
  };

  const cardWaitingQueue = {
    title: 'Waiting Queue',
    value: stats.waitingQueue,
    description: 'Waiting assignment',
    icon: Clock,
    path: '/waiting-queue',
    accent: 'yellow',
  };

  const cardPendingInvestigation = {
    title: 'Pending Investigation',
    value: stats.pendingInvestigation,
    description: 'Internal follow-up',
    icon: AlertTriangle,
    path: '/investigation',
    accent: 'orange',
  };

  const cardClosed = {
    title: 'Closed / Resolved',
    value: stats.closedTickets,
    description: 'Completed records',
    icon: CheckCircle,
    path: '/closed',
    accent: 'green',
  };

  const cardTelegram = {
    title: 'Telegram',
    value: stats.telegramTickets,
    description: 'Telegram channel',
    icon: Send,
    path: '/telegram',
    accent: 'blue',
  };

  const cardChatbot = {
    title: 'Website Chatbot',
    value: stats.chatbotTickets,
    description: 'Website channel',
    icon: MessageCircle,
    path: '/live-chat',
    accent: 'blue',
  };

  const cardAgents = {
    title: 'Agents',
    value: stats.totalAgents,
    description: `${stats.availableAgents} available`,
    icon: Users,
    path: '/agents',
    accent: 'slate',
  };

  // Admin: ticket counters + Agents folded into one 4-card row so the Agents
  // card isn't stranded on its own row at full width. Agents have no admin
  // metric to display, so their channel row holds Telegram + Website Chatbot.
  const metricCards = isAdmin
    ? [cardAllTickets, cardWaitingQueue, cardPendingInvestigation, cardAgents]
    : [cardAllTickets, cardPendingInvestigation, cardClosed];

  const channelCards = isAdmin ? [] : [cardTelegram, cardChatbot];

  const metricGridClass =
    metricCards.length >= 4
      ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-4'
      : metricCards.length === 3
      ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'
      : 'grid gap-4 md:grid-cols-2';

  const channelGridClass =
    channelCards.length >= 2
      ? 'grid gap-4 md:grid-cols-2'
      : 'grid gap-4';

  const recentTickets = tickets.slice(0, 5);

  return (
    <DashboardLayout
      title="Dashboard"
      description="Overview of Central Chat ticket operations."
    >
      {loading ? (
        <div className="flex min-h-72 items-center justify-center rounded-[28px] border border-[#e8edf2] dark:border-white/10 bg-white dark:bg-[#1d1d1f] p-10 text-center text-sm text-[#6e6e73] dark:text-[#a1a1a6] shadow-[0_18px_45px_rgba(15,23,42,0.04)] dark:shadow-none">
          <div>
            <Loader2
              size={24}
              className="mx-auto mb-3 animate-spin text-[#43acd6]"
            />
            Loading dashboard...
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl space-y-5">
          <section className={metricGridClass}>
            {metricCards.map((card) => (
              <DashboardMetricCard
                key={card.title}
                card={card}
                onClick={() => navigate(card.path)}
              />
            ))}
          </section>

          {channelCards.length > 0 && (
            <section className={channelGridClass}>
              {channelCards.map((card) => (
                <ChannelCard
                  key={card.title}
                  card={card}
                  onClick={() => navigate(card.path)}
                />
              ))}
            </section>
          )}

          <div className={isAdmin ? 'grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]' : 'grid gap-5'}>
            <section className="overflow-hidden rounded-[28px] border border-[#e8edf2] dark:border-white/10 bg-white dark:bg-white/5 shadow-[0_18px_45px_rgba(15,23,42,0.04)] dark:shadow-[0_18px_45px_rgba(0,0,0,0.3)] transition-all duration-200 hover:border-[#d8eef7] dark:hover:border-[#43acd6]/30">
              <div className="flex items-center justify-between gap-4 border-b border-[#edf1f5] dark:border-white/10 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Recent Tickets
                  </h2>

                  <p className="mt-1 text-sm text-[#6e6e73] dark:text-[#a1a1a6]">
                    Latest customer issues created in the system.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/tickets')}
                  className="rounded-2xl border border-[#e5e7eb] dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm font-medium text-[#2389b8] dark:text-[#43acd6] transition hover:bg-[#f7fbfd] dark:hover:bg-white/10"
                >
                  View All
                </button>
              </div>

              {recentTickets.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#6e6e73] dark:text-[#a1a1a6]">
                  No recent tickets found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-190 text-left text-sm">
                    <thead className="bg-[#f8fafc] dark:bg-white/5 text-[11px] uppercase tracking-[0.14em] text-[#8e8e93] dark:text-[#a1a1a6]">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Ticket</th>
                        <th className="px-5 py-3 font-semibold">Customer</th>
                        <th className="px-5 py-3 font-semibold">Channel</th>
                        <th className="px-5 py-3 font-semibold">Issue</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 font-semibold">Agent</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#edf1f5] dark:divide-white/10">
                      {recentTickets.map((ticket) => (
                        <tr
                          key={ticket.dbId}
                          onClick={() =>
                            navigate(`/tickets/${ticket.dbId}`, {
                              state: {
                                from: '/dashboard',
                                fromLabel: 'Dashboard',
                              },
                            })
                          }
                          className="cursor-pointer transition hover:bg-[#f7fbfd] dark:hover:bg-white/5"
                        >
                          <td className="px-5 py-4">
                            <div
                              title={ticket.id}
                              className="max-w-37.5 truncate font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
                            >
                              {ticket.id}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div
                              title={ticket.customer}
                              className="max-w-40 truncate text-[#6e6e73] dark:text-[#a1a1a6]"
                            >
                              {ticket.customer || 'Unknown customer'}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <SoftBadge value={ticket.channel || 'Unknown'} />
                          </td>

                          <td className="px-5 py-4">
                            <div
                              title={ticket.category}
                              className="max-w-45 truncate text-[#6e6e73] dark:text-[#a1a1a6]"
                            >
                              {ticket.category || 'No category'}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge status={ticket.status} />
                          </td>

                          <td className="px-5 py-4">
                            <div
                              title={ticket.assignedTo}
                              className="max-w-40 truncate text-[#6e6e73] dark:text-[#a1a1a6]"
                            >
                              {ticket.assignedTo || 'Unassigned'}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {isAdmin && (
            <section className="overflow-hidden rounded-[28px] border border-[#e8edf2] dark:border-white/10 bg-white dark:bg-white/5 shadow-[0_18px_45px_rgba(15,23,42,0.04)] dark:shadow-[0_18px_45px_rgba(0,0,0,0.3)] transition-all duration-200 hover:border-[#d8eef7] dark:hover:border-[#43acd6]/30">
              <div className="border-b border-[#edf1f5] dark:border-white/10 px-5 py-4">
                <h2 className="text-base font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Agent Status
                </h2>

                <p className="mt-1 text-sm text-[#6e6e73] dark:text-[#a1a1a6]">
                  Current availability of support staff.
                </p>
              </div>

              {agents.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#6e6e73] dark:text-[#a1a1a6]">
                  No agents found.
                </div>
              ) : (
                <div className="divide-y divide-[#edf1f5] dark:divide-white/10">
                  {agents.slice(0, 6).map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => navigate('/agents')}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[#f7fbfd] dark:hover:bg-white/5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f7fbfd] dark:bg-[#43acd6]/10 text-sm font-semibold text-[#2389b8] dark:text-[#43acd6] ring-1 ring-[#d8eef7] dark:ring-[#43acd6]/20">
                          {getInitials(agent.name)}
                        </div>

                        <div className="min-w-0">
                          <div
                            title={agent.name}
                            className="truncate font-medium text-[#1d1d1f] dark:text-[#f5f5f7]"
                          >
                            {agent.name}
                          </div>

                          <div
                            title={agent.role}
                            className="mt-1 truncate text-xs text-[#8e8e93] dark:text-[#a1a1a6]"
                          >
                            {agent.role}
                          </div>
                        </div>
                      </div>

                      <AgentStatusBadge status={agent.status} />
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t border-[#edf1f5] dark:border-white/10 p-4">
                <button
                  type="button"
                  onClick={() => navigate('/agents')}
                  className="w-full rounded-2xl border border-[#e5e7eb] dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm font-medium text-[#2389b8] dark:text-[#43acd6] transition hover:bg-[#f7fbfd] dark:hover:bg-white/10"
                >
                  Manage Agents
                </button>
              </div>
            </section>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

const DashboardMetricCard = ({ card, onClick }) => {
  const Icon = card.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-[28px] border border-[#e8edf2] bg-white p-5 text-left shadow-[0_18px_45px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d8eef7] hover:shadow-[0_22px_55px_rgba(67,172,214,0.10)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#6e6e73]">{card.title}</p>

          <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#1d1d1f]">
            {card.value}
          </div>

          <p className="mt-2 text-xs text-[#8e8e93]">{card.description}</p>
        </div>

        {card.sparkline ? (
          <MiniSparkline />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f7fbfd] text-[#2389b8] ring-1 ring-[#d8eef7] transition group-hover:bg-[#43acd6] group-hover:text-white">
            <Icon size={18} />
          </div>
        )}
      </div>
    </button>
  );
};

const ChannelCard = ({ card, onClick }) => {
  const Icon = card.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-3xl border border-[#e8edf2] bg-white p-4 text-left shadow-[0_12px_32px_rgba(15,23,42,0.035)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d8eef7] hover:bg-[#fbfdff]"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm text-[#6e6e73]">{card.title}</div>

          <div className="mt-2 flex items-end gap-2">
            <span className="text-2xl font-semibold tracking-[-0.04em] text-[#1d1d1f]">
              {card.value}
            </span>

            <span className="pb-1 text-xs text-[#8e8e93]">
              {card.description}
            </span>
          </div>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f7fbfd] text-[#2389b8] ring-1 ring-[#d8eef7] transition group-hover:bg-[#43acd6] group-hover:text-white">
          <Icon size={18} />
        </div>
      </div>
    </button>
  );
};

const MiniSparkline = () => {
  return (
    <svg
      width="92"
      height="48"
      viewBox="0 0 92 48"
      fill="none"
      className="shrink-0"
    >
      <path
        d="M4 35 C14 28, 19 31, 27 24 C35 17, 42 26, 50 20 C58 14, 64 8, 72 15 C80 22, 84 12, 88 10"
        stroke="#43acd6"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M4 35 C14 28, 19 31, 27 24 C35 17, 42 26, 50 20 C58 14, 64 8, 72 15 C80 22, 84 12, 88 10 L88 48 L4 48 Z"
        fill="url(#dashboardSparkGradient)"
      />
      <defs>
        <linearGradient
          id="dashboardSparkGradient"
          x1="46"
          y1="10"
          x2="46"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#43acd6" stopOpacity="0.18" />
          <stop offset="1" stopColor="#43acd6" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
};

const SoftBadge = ({ value }) => {
  return (
    <span
      title={value}
      className="inline-flex max-w-35 rounded-full bg-[#f5f5f7] dark:bg-white/5 px-3 py-1 text-xs font-medium text-[#6e6e73] dark:text-[#a1a1a6] ring-1 ring-[#e5e7eb] dark:ring-white/10"
    >
      <span className="truncate">{value}</span>
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const normalized = status?.toLowerCase().trim();

  const className =
    normalized === 'resolved' || normalized === 'closed'
      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 ring-emerald-100 dark:ring-emerald-500/20'
      : normalized === 'pending investigation'
      ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-500 ring-orange-100 dark:ring-orange-500/20'
      : normalized === 'new'
      ? 'bg-[#fffbea] dark:bg-yellow-500/10 text-[#8a6d00] dark:text-yellow-500 ring-[#ffe88a] dark:ring-yellow-500/20'
      : 'bg-[#f5f5f7] dark:bg-white/5 text-[#6e6e73] dark:text-[#a1a1a6] ring-[#e5e7eb] dark:ring-white/10';

  const dotClass =
    normalized === 'resolved' || normalized === 'closed'
      ? 'bg-emerald-500'
      : normalized === 'pending investigation'
      ? 'bg-orange-500'
      : normalized === 'new'
      ? 'bg-[#ffd84d]'
      : 'bg-[#8e8e93] dark:bg-[#6e6e73]';

  return (
    <span
      title={status}
      className={`inline-flex max-w-40 items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      <span className="truncate">{status || 'Unknown'}</span>
    </span>
  );
};

const AgentStatusBadge = ({ status }) => {
  const normalized = status?.toLowerCase().trim();

  const className =
    normalized === 'available'
      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 ring-emerald-100 dark:ring-emerald-500/20'
      : normalized === 'busy'
      ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-500 ring-orange-100 dark:ring-orange-500/20'
      : normalized === 'away'
      ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-500 ring-amber-100 dark:ring-amber-500/20'
      : 'bg-[#f5f5f7] dark:bg-white/5 text-[#6e6e73] dark:text-[#a1a1a6] ring-[#e5e7eb] dark:ring-white/10';

  const dotClass =
    normalized === 'available'
      ? 'bg-emerald-500'
      : normalized === 'busy'
      ? 'bg-orange-500'
      : normalized === 'away'
      ? 'bg-amber-500'
      : 'bg-[#8e8e93] dark:bg-[#6e6e73]';

  return (
    <span
      title={status}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {status || 'Unknown'}
    </span>
  );
};

const getInitials = (name = '') => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || 'A';
};

export default DashboardPage;