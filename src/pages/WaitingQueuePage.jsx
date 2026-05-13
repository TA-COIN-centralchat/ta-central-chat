import DashboardLayout from '../components/layout/DashboardLayout';
import { tickets } from '../data/mockData';

const waitingTickets = tickets.filter(
  (ticket) => ticket.status === 'New' || ticket.assignedTo === 'Unassigned'
);

const WaitingQueuePage = () => {
  return (
    <DashboardLayout
      title="Waiting Queue"
      description="Tickets waiting for an available support agent."
    >
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="font-semibold text-slate-950">Unassigned Tickets</h2>
            <p className="mt-1 text-sm text-slate-500">
              These tickets will be assigned when an agent becomes available.
            </p>
          </div>

          <span className="rounded-full bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700">
            {waitingTickets.length} Waiting
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {waitingTickets.map((ticket, index) => (
            <div
              key={ticket.id}
              className="grid grid-cols-[80px_1fr_180px_180px_160px] items-center gap-4 p-5"
            >
              <div>
                <div className="text-xs text-slate-400">Queue</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">
                  #{index + 1}
                </div>
              </div>

              <div>
                <div className="font-semibold text-slate-900">{ticket.id}</div>
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
                <div className="text-xs text-slate-400">Waiting Time</div>
                <div className="mt-1 text-sm font-medium text-orange-700">
                  5 mins
                </div>
              </div>

              <div className="flex justify-end">
                <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Assign
                </button>
              </div>
            </div>
          ))}

          {waitingTickets.length === 0 && (
            <div className="p-10 text-center">
              <div className="text-lg font-semibold text-slate-900">
                Waiting queue is empty
              </div>
              <p className="mt-2 text-sm text-slate-500">
                New unassigned tickets will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WaitingQueuePage;