import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { getTickets } from '../services/ticketService';

const InvestigationPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInvestigationTickets = async () => {
      try {
        setLoading(true);

        const data = await getTickets();
        const filteredTickets = data.filter(
          (ticket) => ticket.status === 'Pending Investigation'
        );

        setTickets(filteredTickets);
      } catch (error) {
        console.error('Failed to load investigation tickets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInvestigationTickets();
  }, []);

  return (
    <DashboardLayout
      title="Pending Investigation"
      description="Tickets that cannot be solved immediately and need internal follow-up."
    >
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="font-semibold text-slate-950">
              Investigation Tickets
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Customer session may be ended, but internal investigation continues.
            </p>
          </div>

          <span className="rounded-full bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700">
            {tickets.length} Pending
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading pending investigation tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-lg font-semibold text-slate-900">
              No pending investigation tickets
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Escalated tickets will appear here.
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
                  <th className="px-5 py-3">Assigned To</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last Updated</th>
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
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs text-orange-700">
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {ticket.time}
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

export default InvestigationPage;