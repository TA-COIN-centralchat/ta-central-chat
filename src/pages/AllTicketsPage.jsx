import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, Loader2, Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import DashboardLayout from '../components/layout/DashboardLayout';
import { getTickets } from '../services/ticketService';

const statusOptions = [
  'All',
  'New',
  'Assigned',
  'In Progress',
  'Waiting for Customer',
  'Pending Investigation',
  'Ready to Contact Customer',
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

const AllTicketsPage = () => {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [channelFilter, setChannelFilter] = useState('All');

  useEffect(() => {
    const loadTickets = async () => {
      try {
        setLoading(true);
        const data = await getTickets();
        setTickets(data);
      } catch (error) {
        console.error('Failed to load tickets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTickets();
  }, []);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const searchValue = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !searchValue ||
        ticket.id?.toLowerCase().includes(searchValue) ||
        ticket.customer?.toLowerCase().includes(searchValue) ||
        ticket.channel?.toLowerCase().includes(searchValue) ||
        ticket.category?.toLowerCase().includes(searchValue) ||
        ticket.subCategory?.toLowerCase().includes(searchValue) ||
        ticket.status?.toLowerCase().includes(searchValue) ||
        ticket.assignedTo?.toLowerCase().includes(searchValue) ||
        ticket.phone?.toLowerCase().includes(searchValue) ||
        ticket.telegram?.toLowerCase().includes(searchValue) ||
        ticket.email?.toLowerCase().includes(searchValue) ||
        ticket.accountId?.toLowerCase().includes(searchValue) ||
        ticket.transactionId?.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === 'All' || ticket.status === statusFilter;

      const matchesChannel =
        channelFilter === 'All' || ticket.channel === channelFilter;

      return matchesSearch && matchesStatus && matchesChannel;
    });
  }, [tickets, searchTerm, statusFilter, channelFilter]);

  const getStatusClass = (status) => {
    if (status === 'Resolved' || status === 'Closed') {
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    }

    if (status === 'Pending Investigation') {
      return 'bg-orange-50 text-orange-700 ring-orange-100';
    }

    if (status === 'New') {
      return 'bg-[#eef9fd] text-[#2389b8] ring-[#43acd6]/15';
    }

    return 'bg-slate-100 text-slate-600 ring-slate-200';
  };

  const getStatusDotClass = (status) => {
    if (status === 'Resolved' || status === 'Closed') {
      return 'bg-emerald-500';
    }

    if (status === 'Pending Investigation') {
      return 'bg-orange-500';
    }

    if (status === 'New') {
      return 'bg-[#43acd6]';
    }

    return 'bg-slate-400';
  };

  const openTicket = (ticket) => {
    navigate(`/tickets/${ticket.dbId}`, {
      state: {
        from: '/tickets',
        fromLabel: 'All Tickets',
      },
    });
  };

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

  const handleExportCsv = () => {
    if (filteredTickets.length === 0) {
      alert('No tickets available to export.');
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
      'Issue Description / Summary',
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
    link.download = `ta-coin-tickets-${statusName}-${channelName}-${today}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout
      title="All Tickets"
      description="Search, filter, export, and open customer support tickets."
    >
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Tickets" value={tickets.length} tone="blue" />
          <MetricCard
            label="Showing"
            value={filteredTickets.length}
            tone="green"
          />
          <MetricCard label="Status" value={statusFilter} tone="orange" />
          <MetricCard label="Channel" value={channelFilter} tone="slate" />
        </section>

        <section className="overflow-hidden rounded-[28px] border border-black/6 bg-white/85 shadow-[0_16px_50px_rgba(0,0,0,0.04)] backdrop-blur">
          <div className="flex flex-col justify-between gap-4 border-b border-black/6 p-5 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">
                Ticket List
              </h2>

              <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
                {filteredTickets.length} of {tickets.length} tickets shown
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/[0.07] bg-[#f5f5f7] px-4 py-3 text-sm font-medium text-[#6e6e73] transition hover:bg-white hover:text-[#1d1d1f]"
              >
                <Download size={16} />
                Export CSV
              </button>

              <button
                type="button"
                onClick={() => navigate('/manual-ticket')}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#43acd6] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.22)] transition hover:bg-[#2389b8]"
              >
                <Plus size={16} />
                New Ticket
              </button>
            </div>
          </div>

          <div className="border-b border-black/6 p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
              <div className="system-input flex items-center gap-3 rounded-2xl px-4 py-3">
                <Search size={17} className="shrink-0 text-[#8e8e93]" />

                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search ticket, customer, phone, Telegram, issue..."
                  className="w-full bg-transparent text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="system-input rounded-2xl px-4 py-3 text-sm text-[#1d1d1f] outline-none"
              >
                {statusOptions.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>

              <select
                value={channelFilter}
                onChange={(event) => setChannelFilter(event.target.value)}
                className="system-input rounded-2xl px-4 py-3 text-sm text-[#1d1d1f] outline-none"
              >
                {channelOptions.map((channel) => (
                  <option key={channel}>{channel}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-60 items-center justify-center p-10 text-sm text-[#6e6e73]">
              <div className="text-center">
                <Loader2
                  size={26}
                  className="mx-auto mb-3 animate-spin text-[#43acd6]"
                />
                Loading tickets...
              </div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-255 table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-35" />
                  <col className="w-62.5" />
                  <col className="w-37.5" />
                  <col className="w-67.5" />
                  <col className="w-47.5" />
                  <col className="w-45" />
                  <col className="w-30" />
                  <col className="w-30" />
                </colgroup>

                <thead className="bg-[#f5f5f7] text-xs uppercase tracking-[0.16em] text-[#8e8e93]">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Ticket ID</th>
                    <th className="px-5 py-4 font-semibold">Customer</th>
                    <th className="px-5 py-4 font-semibold">Channel</th>
                    <th className="px-5 py-4 font-semibold">Issue</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Assigned Agent</th>
                    <th className="px-5 py-4 font-semibold">Created</th>
                    <th className="sticky right-0 z-20 bg-[#f5f5f7] px-5 py-4 font-semibold shadow-[-1px_0_0_rgba(0,0,0,0.05)]">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-black/5">
                  {filteredTickets.map((ticket) => {
                    const contact =
                      ticket.phone ||
                      ticket.telegram ||
                      ticket.email ||
                      'No contact';

                    const issuePreview = ticket.subCategory || ticket.lastMessage;

                    return (
                      <tr
                        key={ticket.dbId}
                        onClick={() => openTicket(ticket)}
                        className="cursor-pointer transition hover:bg-[#f8fafc]"
                      >
                        <td className="whitespace-nowrap px-5 py-4">
                          <div
                            title={ticket.id}
                            className="truncate font-semibold text-[#1d1d1f]"
                          >
                            {ticket.id}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div
                            title={ticket.customer}
                            className="truncate font-medium text-[#1d1d1f]"
                          >
                            {ticket.customer || 'Unknown customer'}
                          </div>

                          <div
                            title={contact}
                            className="mt-1 truncate text-xs text-[#8e8e93]"
                          >
                            {contact}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            title={ticket.channel}
                            className="inline-flex max-w-full rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-medium text-[#6e6e73] ring-1 ring-black/6"
                          >
                            <span className="truncate">{ticket.channel}</span>
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div
                            title={ticket.category}
                            className="truncate font-medium text-[#1d1d1f]"
                          >
                            {ticket.category || 'No issue type'}
                          </div>

                          <div
                            title={issuePreview}
                            className="mt-1 truncate text-xs text-[#8e8e93]"
                          >
                            {issuePreview || 'No description'}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            title={ticket.status}
                            className={`inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${getStatusClass(
                              ticket.status
                            )}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${getStatusDotClass(
                                ticket.status
                              )}`}
                            />
                            <span className="truncate">{ticket.status}</span>
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div
                            title={ticket.assignedTo}
                            className="truncate text-[#6e6e73]"
                          >
                            {ticket.assignedTo || 'Unassigned'}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <div
                            title={ticket.time}
                            className="truncate text-[#6e6e73]"
                          >
                            {ticket.time}
                          </div>
                        </td>

                        <td className="sticky right-0 z-10 bg-white/95 px-5 py-4 backdrop-blur-sm shadow-[-1px_0_0_rgba(0,0,0,0.05)]">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openTicket(ticket);
                            }}
                            className="inline-flex items-center gap-2 rounded-2xl border border-[#43acd6]/20 bg-[#eef9fd] px-3 py-2 text-sm font-medium text-[#2389b8] transition hover:bg-[#dff3fb]"
                          >
                            <Eye size={16} />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

const MetricCard = ({ label, value, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-[#eef9fd] text-[#2389b8] ring-[#43acd6]/15',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    orange: 'bg-orange-50 text-orange-700 ring-orange-100',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  };

  return (
    <div className="rounded-[26px] border border-black/6 bg-white/85 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.04)] backdrop-blur">
      <div
        className={`mb-4 inline-flex min-h-10 min-w-10 max-w-full items-center justify-center rounded-2xl px-3 text-sm font-semibold ring-1 ${tones[tone]}`}
      >
        <span className="max-w-45 truncate">{value}</span>
      </div>

      <div className="text-sm text-[#6e6e73]">{label}</div>
    </div>
  );
};

const EmptyState = () => {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
        <Eye size={22} />
      </div>

      <h3 className="mt-4 font-semibold text-[#1d1d1f]">No tickets found</h3>

      <p className="mt-2 text-sm text-[#6e6e73]">
        Try changing your search or filter options.
      </p>
    </div>
  );
};

export default AllTicketsPage;