import { useEffect, useState } from 'react';
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

  return (
    <DashboardLayout
      title="Waiting Queue"
      description="Tickets waiting for an available support agent."
    >
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="font-semibold text-slate-950">
              Unassigned Tickets
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              The system auto-assigns queue tickets to available agents with the lowest workload.
            </p>
          </div>

          <div className="flex items-center gap-3">
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

        {message && (
          <div className="border-b border-slate-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading waiting queue...
          </div>
        ) : waitingTickets.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-lg font-semibold text-slate-900">
              Waiting queue is empty
            </div>
            <p className="mt-2 text-sm text-slate-500">
              New unassigned tickets will appear here only when no agent is available.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {waitingTickets.map((ticket, index) => (
              <div
                key={ticket.dbId}
                className="grid grid-cols-[80px_1fr_180px_180px_220px] items-center gap-4 p-5"
              >
                <div>
                  <div className="text-xs text-slate-400">Queue</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">
                    #{index + 1}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-slate-900">
                    {ticket.id}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {ticket.customer} · {ticket.channel}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {ticket.lastMessage}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400">Issue Type</div>
                  <div className="mt-1 text-sm font-medium text-slate-800">
                    {ticket.category}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400">Status</div>
                  <div className="mt-1">
                    <span className="rounded-full bg-orange-50 px-3 py-1 text-xs text-orange-700">
                      {ticket.status}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/tickets/${ticket.dbId}`)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                  >
                    View
                  </button>

                  <button
                    type="button"
                    onClick={handleAutoAssign}
                    disabled={assigning}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Assign
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default WaitingQueuePage;