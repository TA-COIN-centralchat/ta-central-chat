import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, Loader2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import DashboardLayout from '../components/layout/DashboardLayout';
import { getTickets } from '../services/ticketService';

const InvestigationPage = () => {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadInvestigationTickets = async () => {
      try {
        setLoading(true);

        const data = await getTickets();

        const investigationTickets = data.filter((ticket) => {
          const status = ticket.status?.toLowerCase().trim();

          return (
            status === 'pending investigation' ||
            status === 'pending review'
          );
        });

        setTickets(investigationTickets);
      } catch (error) {
        console.error('Failed to load investigation tickets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInvestigationTickets();
  }, []);

  const filteredTickets = useMemo(() => {
    const searchValue = searchTerm.toLowerCase().trim();

    if (!searchValue) return tickets;

    return tickets.filter((ticket) => {
      return (
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
        ticket.transactionId?.toLowerCase().includes(searchValue)
      );
    });
  }, [tickets, searchTerm]);

  const openTicket = (ticket) => {
    navigate(`/tickets/${ticket.dbId}`, {
      state: {
        from: '/investigation',
        fromLabel: 'Pending Investigation',
      },
    });
  };

  return (
    <DashboardLayout
      title="Pending Investigation"
      description="Tickets that cannot be solved immediately and need internal follow-up."
    >
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[28px] border border-black/6 bg-white/90 shadow-[0_14px_40px_rgba(0,0,0,0.035)] backdrop-blur">
          <div className="flex flex-col justify-between gap-4 border-b border-black/6 px-5 py-4 lg:flex-row lg:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-700 ring-1 ring-orange-100">
                <AlertTriangle size={19} />
              </div>

              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">
                  Investigation Tickets
                </h2>

                <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
                  {filteredTickets.length} of {tickets.length} pending
                  investigation tickets shown.
                </p>
              </div>
            </div>

          </div>

          <div className="border-b border-black/6 px-5 py-4">
            <div className="system-input flex h-11 max-w-xl items-center gap-3 rounded-2xl px-4">
              <Search size={16} className="shrink-0 text-[#8e8e93]" />

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search investigation tickets..."
                className="w-full bg-transparent text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-44 items-center justify-center p-8 text-sm text-[#6e6e73]">
              <div className="text-center">
                <Loader2
                  size={24}
                  className="mx-auto mb-3 animate-spin text-[#43acd6]"
                />
                Loading pending investigation tickets...
              </div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-260 table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-35" />
                  <col className="w-62.5" />
                  <col className="w-37.5" />
                  <col className="w-70" />
                  <col className="w-45" />
                  <col className="w-45" />
                  <col className="w-32.5" />
                  <col className="w-30" />
                </colgroup>

                <thead className="bg-[#f5f5f7] text-[11px] uppercase tracking-[0.16em] text-[#8e8e93]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Ticket ID</th>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Channel</th>
                    <th className="px-5 py-3 font-semibold">Issue Type</th>
                    <th className="px-5 py-3 font-semibold">Assigned To</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Created</th>
                    <th className="sticky right-0 z-20 bg-[#f5f5f7] px-5 py-3 font-semibold shadow-[-1px_0_0_rgba(0,0,0,0.05)]">
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

                    const issuePreview =
                      ticket.subCategory || ticket.lastMessage || '-';

                    return (
                      <tr
                        key={ticket.dbId}
                        onClick={() => openTicket(ticket)}
                        className="cursor-pointer transition hover:bg-[#f8fafc]"
                      >
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <div
                            title={ticket.id}
                            className="truncate font-semibold text-[#1d1d1f]"
                          >
                            {ticket.id}
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
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

                        <td className="px-5 py-3.5">
                          <span
                            title={ticket.channel || '-'}
                            className="inline-flex max-w-full rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-medium text-[#6e6e73] ring-1 ring-black/6"
                          >
                            <span className="truncate">
                              {ticket.channel || '-'}
                            </span>
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <div
                            title={ticket.category || '-'}
                            className="truncate font-medium text-[#1d1d1f]"
                          >
                            {ticket.category || '-'}
                          </div>

                          <div
                            title={issuePreview}
                            className="mt-1 truncate text-xs text-[#8e8e93]"
                          >
                            {issuePreview}
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <div
                            title={ticket.assignedTo || 'Unassigned'}
                            className="truncate text-[#6e6e73]"
                          >
                            {ticket.assignedTo || 'Unassigned'}
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <StatusBadge status={ticket.status} />
                        </td>

                        <td className="whitespace-nowrap px-5 py-3.5">
                          <div
                            title={ticket.time || '-'}
                            className="truncate text-[#6e6e73]"
                          >
                            {ticket.time || '-'}
                          </div>
                        </td>

                        <td className="sticky right-0 z-10 bg-white/95 px-5 py-3.5 backdrop-blur-sm shadow-[-1px_0_0_rgba(0,0,0,0.05)]">
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

const StatusBadge = ({ status }) => {
  return (
    <span
      title={status}
      className="inline-flex max-w-full items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 ring-1 ring-orange-100"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
      <span className="truncate">{status || 'Pending'}</span>
    </span>
  );
};

const EmptyState = () => {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-700">
        <AlertTriangle size={22} />
      </div>

      <h3 className="mt-4 font-semibold text-[#1d1d1f]">
        No pending investigation tickets found
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6e6e73]">
        No tickets currently have Pending Review or Pending Investigation
        status.
      </p>
    </div>
  );
};

export default InvestigationPage;