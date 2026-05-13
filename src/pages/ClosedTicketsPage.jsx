import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { getTickets } from '../services/ticketService';

const ClosedTicketsPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadClosedTickets = async () => {
      try {
        setLoading(true);

        const data = await getTickets();
        const filteredTickets = data.filter(
          (ticket) => ticket.status === 'Closed' || ticket.status === 'Resolved'
        );

        setTickets(filteredTickets);
      } catch (error) {
        console.error('Failed to load closed tickets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadClosedTickets();
  }, []);

  return (
    <DashboardLayout
      title="Closed Tickets"
      description="View resolved and archived customer support tickets."
    >
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="font-semibold text-slate-950">
              Closed Ticket Archive
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Historical support records for review and reporting.
            </p>
          </div>

          <input
            placeholder="Search closed tickets..."
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading closed tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-lg font-semibold text-slate-900">
              No closed tickets found
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Resolved or closed tickets will appear here.
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
                  <th className="px-5 py-3">Issue Type</th>
                  <th className="px-5 py-3">Resolved By</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Resolution Summary</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {tickets.map((ticket) => (
                  <tr key={ticket.dbId}>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {ticket.id}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {ticket.customer}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {ticket.channel}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {ticket.category}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {ticket.assignedTo}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                        {ticket.status}
                      </span>
                    </td>
                    <td className="max-w-xs px-5 py-4 text-slate-600">
                      {ticket.lastMessage}
                    </td>
                    <td className="px-5 py-4">
                      <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
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

export default ClosedTicketsPage;