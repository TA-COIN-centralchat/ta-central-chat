import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Eye,
  Loader2,
  Search,
  Sparkles,
  Timer,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import DashboardLayout from '../components/layout/DashboardLayout';
import {
  autoAssignWaitingTickets,
  getTickets,
} from '../services/ticketService';

const WaitingQueuePage = () => {
  const navigate = useNavigate();

  const [waitingTickets, setWaitingTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const loadWaitingTickets = async () => {
    try {
      setLoading(true);

      const data = await getTickets();

      const filteredTickets = data.filter(
        (ticket) => ticket.status === 'New' || ticket.assignedTo === 'Unassigned'
      );

      setWaitingTickets(filteredTickets);
    } catch (error) {
      console.error('Failed to load waiting queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoAssign = async () => {
    try {
      setAssigning(true);
      setMessage('');

      const result = await autoAssignWaitingTickets();

      setMessage(result.message);

      await loadWaitingTickets();
    } catch (error) {
      console.error('Failed to auto assign queue:', error);
      alert('Failed to auto assign queue. Please check console.');
    } finally {
      setAssigning(false);
    }
  };

  useEffect(() => {
    const runQueueCheck = async () => {
      await handleAutoAssign();
      await loadWaitingTickets();
    };

    runQueueCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredWaitingTickets = useMemo(() => {
    const searchValue = searchTerm.toLowerCase().trim();

    if (!searchValue) return waitingTickets;

    return waitingTickets.filter((ticket) => {
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
  }, [waitingTickets, searchTerm]);

  const openTicket = (ticket) => {
    navigate(`/tickets/${ticket.dbId}`, {
      state: {
        from: '/waiting-queue',
        fromLabel: 'Waiting Queue',
      },
    });
  };

  return (
    <DashboardLayout
      title="Waiting Queue"
      description="Tickets waiting for an available support agent."
    >
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[28px] border border-[#e8edf2] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 border-b border-[#edf1f5] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f7fbfd] text-[#2389b8] ring-1 ring-[#d8eef7]">
                <Timer size={20} />
              </div>

              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">
                  Unassigned Tickets
                </h2>

                <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
                  {filteredWaitingTickets.length} of {waitingTickets.length}{' '}
                  waiting tickets shown.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleAutoAssign}
                disabled={assigning}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#43acd6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:bg-[#2389b8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {assigning ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Auto Assign Queue
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="border-b border-[#edf1f5] px-5 py-4">
            <div className="system-input flex h-11 max-w-xl items-center gap-3 rounded-2xl px-4">
              <Search size={16} className="shrink-0 text-[#8e8e93]" />

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search queue tickets..."
                className="w-full bg-transparent text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
              />
            </div>
          </div>

          {message && (
            <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-700">
              {message}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-72 items-center justify-center p-10 text-center text-sm text-[#6e6e73]">
              <div>
                <Loader2
                  size={24}
                  className="mx-auto mb-3 animate-spin text-[#43acd6]"
                />
                Loading waiting queue...
              </div>
            </div>
          ) : filteredWaitingTickets.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-225 text-left text-sm">
                <thead className="bg-[#f8fafc] text-[11px] uppercase tracking-[0.14em] text-[#8e8e93]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Queue</th>
                    <th className="px-5 py-3 font-semibold">Ticket</th>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Channel</th>
                    <th className="px-5 py-3 font-semibold">Issue Type</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#edf1f5]">
                  {filteredWaitingTickets.map((ticket, index) => (
                    <tr
                      key={ticket.dbId}
                      onClick={() => openTicket(ticket)}
                      className="cursor-pointer transition hover:bg-[#f7fbfd]"
                    >
                      <td className="px-5 py-4">
                        <div className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-[#fffbea] px-3 text-sm font-semibold text-[#8a6d00] ring-1 ring-[#ffe88a]">
                          #{index + 1}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div
                          title={ticket.id}
                          className="max-w-45 truncate font-semibold text-[#1d1d1f]"
                        >
                          {ticket.id}
                        </div>

                        <div
                          title={ticket.lastMessage}
                          className="mt-1 max-w-65 truncate text-xs text-[#8e8e93]"
                        >
                          {ticket.lastMessage || 'No recent message.'}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div
                          title={ticket.customer}
                          className="max-w-45 truncate font-medium text-[#1d1d1f]"
                        >
                          {ticket.customer || 'Unknown customer'}
                        </div>

                        <div
                          title={
                            ticket.phone ||
                            ticket.telegram ||
                            ticket.email ||
                            'No contact'
                          }
                          className="mt-1 max-w-50 truncate text-xs text-[#8e8e93]"
                        >
                          {ticket.phone ||
                            ticket.telegram ||
                            ticket.email ||
                            'No contact'}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <SoftBadge value={ticket.channel || 'Unknown'} />
                      </td>

                      <td className="px-5 py-4">
                        <div
                          title={ticket.category}
                          className="max-w-47.5 truncate text-[#6e6e73]"
                        >
                          {ticket.category || 'No category'}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge value={ticket.status || 'New'} />
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openTicket(ticket);
                            }}
                            className="inline-flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm font-medium text-[#6e6e73] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                          >
                            <Eye size={15} />
                            View
                          </button>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAutoAssign();
                            }}
                            disabled={assigning}
                            className="inline-flex items-center gap-2 rounded-2xl bg-[#43acd6] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#2389b8] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {assigning ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <ArrowRight size={15} />
                            )}
                            Assign
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

const SoftBadge = ({ value }) => {
  return (
    <span
      title={value}
      className="inline-flex max-w-40 rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-medium text-[#6e6e73] ring-1 ring-[#e5e7eb]"
    >
      <span className="truncate">{value}</span>
    </span>
  );
};

const StatusBadge = ({ value }) => {
  return (
    <span
      title={value}
      className="inline-flex max-w-45 items-center gap-2 rounded-full bg-[#fffbea] px-3 py-1 text-xs font-medium text-[#8a6d00] ring-1 ring-[#ffe88a]"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffd84d]" />
      <span className="truncate">{value}</span>
    </span>
  );
};

const EmptyState = () => {
  return (
    <div className="p-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f7fbfd] text-[#2389b8] ring-1 ring-[#d8eef7]">
        <Timer size={22} />
      </div>

      <h3 className="mt-4 text-base font-semibold text-[#1d1d1f]">
        Waiting queue is empty
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6e6e73]">
        New unassigned tickets will appear here only when no agent is available.
      </p>
    </div>
  );
};

export default WaitingQueuePage;