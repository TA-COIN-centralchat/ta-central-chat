import DashboardLayout from '../components/layout/DashboardLayout';
import { tickets } from '../data/mockData';

const closedTickets = [
  {
    id: 'TAC-20260504-010',
    customer: 'Rina',
    channel: 'Telegram',
    category: 'Deposit Issue',
    status: 'Closed',
    resolvedBy: 'Agent Lina',
    closedDate: '04 May 2026',
    summary: 'Deposit confirmed and customer informed.',
  },
  {
    id: 'TAC-20260504-011',
    customer: 'Makara',
    channel: 'Website Chatbot',
    category: 'Login Issue',
    status: 'Closed',
    resolvedBy: 'Agent Dara',
    closedDate: '04 May 2026',
    summary: 'Customer reset password successfully.',
  },
  ...tickets
    .filter((ticket) => ticket.status === 'Closed')
    .map((ticket) => ({
      ...ticket,
      resolvedBy: ticket.assignedTo,
      closedDate: '04 May 2026',
      summary: ticket.lastMessage,
    })),
];

const ClosedTicketsPage = () => {
  return (
    <DashboardLayout
      title="Closed Tickets"
      description="View resolved and archived customer support tickets."
    >
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="font-semibold text-slate-950">Closed Ticket Archive</h2>
            <p className="mt-1 text-sm text-slate-500">
              Historical support records for review and reporting.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              placeholder="Search closed tickets..."
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">
              Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Ticket ID</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Channel</th>
                <th className="px-5 py-3">Issue Type</th>
                <th className="px-5 py-3">Resolved By</th>
                <th className="px-5 py-3">Closed Date</th>
                <th className="px-5 py-3">Resolution Summary</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {closedTickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td className="px-5 py-4 font-medium text-slate-900">{ticket.id}</td>
                  <td className="px-5 py-4 text-slate-600">{ticket.customer}</td>
                  <td className="px-5 py-4 text-slate-600">{ticket.channel}</td>
                  <td className="px-5 py-4 text-slate-600">{ticket.category}</td>
                  <td className="px-5 py-4 text-slate-600">{ticket.resolvedBy}</td>
                  <td className="px-5 py-4 text-slate-600">{ticket.closedDate}</td>
                  <td className="max-w-xs px-5 py-4 text-slate-600">
                    {ticket.summary}
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
      </div>
    </DashboardLayout>
  );
};

export default ClosedTicketsPage;