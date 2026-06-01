import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Download, Loader2, Ticket, Users } from 'lucide-react';

import DashboardLayout from '../components/layout/DashboardLayout';
import { getAgents, getTickets } from '../services/ticketService';

const statusOptions = [
  'All',
  'New',
  'Assigned',
  'In Progress',
  'Waiting for Customer',
  'Pending Investigation',
  'Resolved',
  'Closed',
];

const channelOptions = [
  'All',
  'Website Chatbot',
  'Telegram',
  'Walk-in',
  'Phone Call',
  'Office Visit',
  'Other',
];

const chartColors = [
  '#43acd6',
  '#54c6a0',
  '#ffd84d',
  '#8b7cf6',
  '#cbd5e1',
  '#f97316',
];

const ReportsPage = () => {
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('All');
  const [channelFilter, setChannelFilter] = useState('All');

  useEffect(() => {
    const loadReports = async () => {
      try {
        setLoading(true);

        const [ticketData, agentData] = await Promise.all([
          getTickets(),
          getAgents(),
        ]);

        setTickets(ticketData);
        setAgents(agentData);
      } catch (error) {
        console.error('Failed to load reports:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, []);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesStatus =
        statusFilter === 'All' || ticket.status === statusFilter;

      const matchesChannel =
        channelFilter === 'All' || ticket.channel === channelFilter;

      return matchesStatus && matchesChannel;
    });
  }, [tickets, statusFilter, channelFilter]);

  const countByStatus = (status) =>
    filteredTickets.filter((ticket) => ticket.status === status).length;

  const channelStats = Object.values(
    filteredTickets.reduce((acc, ticket) => {
      const key = ticket.channel || 'Unknown';

      if (!acc[key]) {
        acc[key] = {
          label: key,
          value: 0,
        };
      }

      acc[key].value += 1;
      return acc;
    }, {})
  );

  const issueStats = Object.values(
    filteredTickets.reduce((acc, ticket) => {
      const key = ticket.category || 'Other';

      if (!acc[key]) {
        acc[key] = {
          label: key,
          value: 0,
        };
      }

      acc[key].value += 1;
      return acc;
    }, {})
  );

  const resolvedClosedCount = filteredTickets.filter(
    (ticket) => ticket.status === 'Resolved' || ticket.status === 'Closed'
  ).length;

  const pendingCount = countByStatus('Pending Investigation');

  const activeAgentCount = agents.filter(
    (agent) => agent.status === 'Available' || agent.status === 'Busy'
  ).length;

  const resolutionRate =
    filteredTickets.length > 0
      ? Math.round((resolvedClosedCount / filteredTickets.length) * 100)
      : 0;

  const escapeCsvValue = (value) => {
    if (value === null || value === undefined) return '';

    const stringValue = String(value).replaceAll('"', '""');

    if (
      stringValue.includes(',') ||
      stringValue.includes('"') ||
      stringValue.includes('\n')
    ) {
      return `"${stringValue}"`;
    }

    return stringValue;
  };

  const handleExportReport = () => {
    if (filteredTickets.length === 0) {
      alert('No ticket data available to export.');
      return;
    }

    const headers = [
      'Ticket ID',
      'Customer',
      'Channel',
      'Issue Type',
      'Sub-category',
      'Status',
      'Assigned Agent',
      'Phone',
      'Telegram',
      'Email',
      'T.A Coin User ID',
      'Transaction ID',
      'Last Message / Summary',
      'Created Time',
    ];

    const rows = filteredTickets.map((ticket) => [
      ticket.id,
      ticket.customer,
      ticket.channel,
      ticket.category,
      ticket.subCategory || '',
      ticket.status,
      ticket.assignedTo,
      ticket.phone || '',
      ticket.telegram || '',
      ticket.email || '',
      ticket.accountId || '',
      ticket.transactionId || '',
      ticket.lastMessage || '',
      ticket.time || '',
    ]);

    const csvContent = [
      headers.map(escapeCsvValue).join(','),
      ...rows.map((row) => row.map(escapeCsvValue).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const today = new Date().toISOString().slice(0, 10);
    const statusName = statusFilter.replaceAll(' ', '-').toLowerCase();
    const channelName = channelFilter.replaceAll(' ', '-').toLowerCase();

    link.href = url;
    link.download = `ta-coin-report-${statusName}-${channelName}-${today}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout
      title="Reports"
      description="Monitor ticket volume, channel usage, issue types, and agent performance."
    >
      {loading ? (
        <div className="flex min-h-72 items-center justify-center rounded-[28px] border border-[#e8edf2] bg-white p-10 text-center text-sm text-[#6e6e73] shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
          <div>
            <Loader2
              size={24}
              className="mx-auto mb-3 animate-spin text-[#43acd6]"
            />
            Loading reports...
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl space-y-5">
          <section className="rounded-[28px] border border-[#e8edf2] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-[#d8eef7]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">
                  Report Overview
                </h2>

                <p className="mt-1 text-sm text-[#6e6e73]">
                  Showing {filteredTickets.length} of {tickets.length} tickets.
                </p>
              </div>

              <div className="grid w-full gap-3 md:grid-cols-3 xl:w-auto">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-11 rounded-2xl border border-[#e8edf2] bg-[#f8fafc] px-4 text-sm text-[#1d1d1f] outline-none transition focus:border-[#43acd6] focus:bg-white focus:ring-4 focus:ring-[#43acd6]/10 md:w-56"
                >
                  {statusOptions.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>

                <select
                  value={channelFilter}
                  onChange={(event) => setChannelFilter(event.target.value)}
                  className="h-11 rounded-2xl border border-[#e8edf2] bg-[#f8fafc] px-4 text-sm text-[#1d1d1f] outline-none transition focus:border-[#43acd6] focus:bg-white focus:ring-4 focus:ring-[#43acd6]/10 md:w-56"
                >
                  {channelOptions.map((channel) => (
                    <option key={channel}>{channel}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleExportReport}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#43acd6] px-4 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:-translate-y-0.5 hover:bg-[#2389b8] hover:shadow-[0_18px_36px_rgba(67,172,214,0.24)]"
                >
                  <Download size={16} />
                  Export
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total Tickets"
              value={filteredTickets.length}
              helper={`${tickets.length} total records`}
              icon={Ticket}
              sparkline
            />

            <MetricCard
              label="Resolution Rate"
              value={`${resolutionRate}%`}
              helper={`${resolvedClosedCount} completed`}
              icon={CheckCircle}
              sparkline
            />

            <MetricCard
              label="Pending"
              value={pendingCount}
              helper="Needs internal review"
              icon={Ticket}
            />

            <MetricCard
              label="Active Agents"
              value={activeAgentCount}
              helper={`${agents.length} total agents`}
              icon={Users}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <DonutCard
              title="Tickets by Channel"
              total={filteredTickets.length}
              data={channelStats}
              emptyText="No channel data available."
            />

            <DonutCard
              title="Tickets by Issue Type"
              total={filteredTickets.length}
              data={issueStats}
              emptyText="No issue type data available."
            />
          </section>

          <section className="overflow-hidden rounded-[28px] border border-[#e8edf2] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-[#d8eef7]">
            <div className="flex flex-col justify-between gap-4 border-b border-[#edf1f5] px-5 py-4 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">
                  Agent Performance
                </h2>

                <p className="mt-1 text-sm text-[#6e6e73]">
                  Assigned ticket overview by agent.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-205 text-left text-sm">
                <thead className="bg-[#f8fafc] text-[11px] uppercase tracking-[0.14em] text-[#8e8e93]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Agent</th>
                    <th className="px-5 py-3 font-semibold">Role</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Active</th>
                    <th className="px-5 py-3 font-semibold">Resolved</th>
                    <th className="px-5 py-3 font-semibold">Assigned</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#edf1f5]">
                  {agents.map((agent) => {
                    const assignedTickets = filteredTickets.filter(
                      (ticket) => ticket.assignedTo === agent.name
                    ).length;

                    return (
                      <tr
                        key={agent.id}
                        className="transition hover:bg-[#f7fbfd]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f7fbfd] text-sm font-semibold text-[#2389b8] ring-1 ring-[#d8eef7] transition group-hover:bg-[#43acd6] group-hover:text-white">
                              {getInitials(agent.name)}
                            </div>

                            <div className="min-w-0">
                              <div
                                title={agent.name}
                                className="truncate font-semibold text-[#1d1d1f]"
                              >
                                {agent.name}
                              </div>

                              <div className="mt-1 text-xs text-[#8e8e93]">
                                Agent
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-[#6e6e73]">
                          {agent.role}
                        </td>

                        <td className="px-5 py-4">
                          <AgentStatus status={agent.status} />
                        </td>

                        <td className="px-5 py-4 text-[#1d1d1f]">
                          {agent.activeTickets}
                        </td>

                        <td className="px-5 py-4 text-[#1d1d1f]">
                          {agent.resolvedToday}
                        </td>

                        <td className="px-5 py-4 text-[#1d1d1f]">
                          {assignedTickets}
                        </td>
                      </tr>
                    );
                  })}

                  {agents.length === 0 && (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-5 py-10 text-center text-sm text-[#6e6e73]"
                      >
                        No agents found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
};

const MetricCard = ({ label, value, helper, icon: Icon, sparkline = false }) => {
  return (
    <div className="group rounded-[28px] border border-[#e8edf2] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d8eef7] hover:shadow-[0_22px_55px_rgba(67,172,214,0.10)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-[#6e6e73]">{label}</div>

          <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#1d1d1f]">
            {value}
          </div>

          <div className="mt-2 text-xs text-emerald-600">{helper}</div>
        </div>

        {sparkline ? (
          <MiniSparkline />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f7fbfd] text-[#2389b8] ring-1 ring-[#d8eef7] transition group-hover:bg-[#43acd6] group-hover:text-white">
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
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
        fill="url(#sparkGradient)"
      />
      <defs>
        <linearGradient
          id="sparkGradient"
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

const DonutCard = ({ title, total, data, emptyText }) => {
  const chartData = data.slice(0, 5);
  const chartTotal = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="rounded-[28px] border border-[#e8edf2] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d8eef7] hover:shadow-[0_22px_55px_rgba(67,172,214,0.10)]">
      <h2 className="text-base font-semibold text-[#1d1d1f]">{title}</h2>

      {chartData.length === 0 ? (
        <div className="mt-5 rounded-[22px] border border-[#e8edf2] bg-[#f8fafc] p-8 text-center text-sm text-[#6e6e73]">
          {emptyText}
        </div>
      ) : (
        <div className="mt-5 grid gap-6 md:grid-cols-[190px_1fr] md:items-center">
          <div className="relative mx-auto h-45 w-45">
            <DonutChart data={chartData} total={chartTotal} />

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl font-semibold tracking-[-0.04em] text-[#1d1d1f]">
                {total}
              </div>
              <div className="text-xs text-[#8e8e93]">Total</div>
            </div>
          </div>

          <div className="space-y-1">
            {chartData.map((item, index) => {
              const percentage =
                chartTotal > 0 ? Math.round((item.value / chartTotal) * 100) : 0;

              return (
                <div
                  key={item.label}
                  className="grid grid-cols-[1fr_48px_44px] items-center gap-3 rounded-2xl px-3 py-2 text-sm transition hover:bg-[#f8fafc]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: chartColors[index] }}
                    />

                    <span
                      title={item.label}
                      className="truncate text-[#1d1d1f]"
                    >
                      {item.label}
                    </span>
                  </div>

                  <span className="text-right text-[#6e6e73]">
                    {percentage}%
                  </span>

                  <span className="text-right text-[#8e8e93]">
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

const DonutChart = ({ data, total }) => {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
      <circle
        cx="80"
        cy="80"
        r={radius}
        fill="transparent"
        stroke="#edf1f5"
        strokeWidth="18"
      />

      {data.map((item, index) => {
        const value = total > 0 ? item.value / total : 0;
        const dash = value * circumference;
        const currentOffset = offset;

        // eslint-disable-next-line react-hooks/immutability
        offset += dash;

        return (
          <circle
            key={item.label}
            cx="80"
            cy="80"
            r={radius}
            fill="transparent"
            stroke={chartColors[index]}
            strokeWidth="18"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-currentOffset}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
};

const AgentStatus = ({ status }) => {
  const normalized = status?.toLowerCase();

  const className =
    normalized === 'available'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
      : normalized === 'busy'
      ? 'bg-orange-50 text-orange-700 ring-orange-100'
      : normalized === 'away'
      ? 'bg-amber-50 text-amber-700 ring-amber-100'
      : 'bg-[#f5f5f7] text-[#6e6e73] ring-[#e5e7eb]';

  const dotClass =
    normalized === 'available'
      ? 'bg-emerald-500'
      : normalized === 'busy'
      ? 'bg-orange-500'
      : normalized === 'away'
      ? 'bg-amber-500'
      : 'bg-[#8e8e93]';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${className}`}
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

export default ReportsPage;