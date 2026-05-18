import { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
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
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-950">
                Unassigned Tickets
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredWaitingTickets.length} of {waitingTickets.length} waiting tickets shown.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700">
                {waitingTickets.length} Waiting
              </span>

              <button
                type="button"
                onClick={handleAutoAssign}
                disabled={assigning}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {assigning ? 'Assigning...' : 'Auto Assign Queue'}
              </button>
            </div>
          </div>

          <div className="mt-5">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search queue tickets..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 md:w-96"
            />
          </div>
        </div>

        {message && (
          <div className="border-b border-slate-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading waiting queue...
          </div>
        ) : filteredWaitingTickets.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-lg font-semibold text-slate-900">
              Waiting queue is empty
            </div>
            <p className="mt-2 text-sm text-slate-500">
              New unassigned tickets will appear here only when no agent is available.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Queue</th>
                  <th className="px-5 py-3">Ticket</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Channel</th>
                  <th className="px-5 py-3">Issue Type</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredWaitingTickets.map((ticket, index) => (
                  <tr
                    key={ticket.dbId}
                    onClick={() => openTicket(ticket)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <div className="text-xs text-slate-400">Position</div>
                      <div className="mt-1 font-semibold text-slate-950">
                        #{index + 1}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">
                        {ticket.id}
                      </div>
                      <div className="mt-1 max-w-xs truncate text-xs text-slate-500">
                        {ticket.lastMessage}
                      </div>
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

                    <td className="px-5 py-4 text-slate-600">
                      {ticket.category}
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                        {ticket.status}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex gap-2">
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

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleAutoAssign();
                          }}
                          disabled={assigning}
                          className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
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
      </div>
    </DashboardLayout>
  );
};

export default WaitingQueuePage;