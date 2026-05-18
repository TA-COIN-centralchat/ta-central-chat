import { useEffect, useMemo, useState } from 'react';
import { Download, Eye } from 'lucide-react';
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
      return 'bg-emerald-50 text-emerald-700';
    }

    if (status === 'Pending Investigation') {
      return 'bg-orange-50 text-orange-700';
    }

    if (status === 'New') {
      return 'bg-blue-50 text-blue-700';
    }

    return 'bg-slate-100 text-slate-700';
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
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-950">Ticket List</h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredTickets.length} of {tickets.length} tickets shown
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download size={16} />
                Export CSV
              </button>

              <button
                type="button"
                onClick={() => navigate('/manual-ticket')}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + New Ticket
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px_220px]">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search ticket, customer, phone, Telegram, issue..."
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              {statusOptions.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>

            <select
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              {channelOptions.map((channel) => (
                <option key={channel}>{channel}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading tickets...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-lg font-semibold text-slate-900">
              No tickets found
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Try changing your search or filter options.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Ticket ID</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Channel</th>
                  <th className="px-5 py-3">Issue</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Assigned Agent</th>
                  <th className="px-5 py-3">Transaction</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.dbId}
                    onClick={() => openTicket(ticket)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                      {ticket.id}
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">
                        {ticket.customer}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {ticket.phone ||
                          ticket.telegram ||
                          ticket.email ||
                          'No contact'}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {ticket.channel}
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800">
                        {ticket.category}
                      </div>
                      <div className="mt-1 max-w-xs truncate text-xs text-slate-500">
                        {ticket.subCategory || ticket.lastMessage}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
                          ticket.status
                        )}`}
                      >
                        {ticket.status}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {ticket.assignedTo}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {ticket.transactionId || 'N/A'}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {ticket.time}
                    </td>

                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openTicket(ticket);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                      >
                        <Eye size={16} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AllTicketsPage;