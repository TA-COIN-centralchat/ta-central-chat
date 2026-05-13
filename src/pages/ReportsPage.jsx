import DashboardLayout from '../components/layout/DashboardLayout';
import { agents } from '../data/mockData';

const reportCards = [
  { label: 'Total Tickets', value: 124 },
  { label: 'Open Tickets', value: 28 },
  { label: 'Closed Tickets', value: 76 },
  { label: 'Pending Investigation', value: 9 },
  { label: 'Avg Response Time', value: '3m' },
  { label: 'Avg Resolution Time', value: '24m' },
];

const channelStats = [
  { channel: 'Website Chatbot', tickets: 52 },
  { channel: 'Telegram', tickets: 41 },
  { channel: 'Walk-in', tickets: 18 },
  { channel: 'Phone Call', tickets: 13 },
];

const issueStats = [
  { issue: 'P2P Issue', tickets: 32 },
  { issue: 'Withdrawal Issue', tickets: 28 },
  { issue: 'Payment Issue', tickets: 23 },
  { issue: 'Login Issue', tickets: 17 },
  { issue: 'KYC Issue', tickets: 12 },
];

const ReportsPage = () => {
  return (
    <DashboardLayout
      title="Reports"
      description="Monitor ticket volume, channel usage, and agent performance."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="text-sm text-slate-500">{card.label}</div>
            <div className="mt-3 text-3xl font-semibold text-slate-950">
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Tickets by Channel</h2>
          <div className="mt-5 space-y-4">
            {channelStats.map((item) => (
              <div key={item.channel}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-slate-700">{item.channel}</span>
                  <span className="text-slate-500">{item.tickets}</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100">
                  <div
                    className="h-3 rounded-full bg-blue-600"
                    style={{ width: `${Math.min(item.tickets, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Tickets by Issue Type</h2>
          <div className="mt-5 space-y-4">
            {issueStats.map((item) => (
              <div key={item.issue}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-slate-700">{item.issue}</span>
                  <span className="text-slate-500">{item.tickets}</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100">
                  <div
                    className="h-3 rounded-full bg-emerald-600"
                    style={{ width: `${Math.min(item.tickets * 2, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="font-semibold text-slate-950">Agent Performance</h2>
            <p className="mt-1 text-sm text-slate-500">
              Overview of active tickets and resolved tickets by agent.
            </p>
          </div>

          <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">
            Export Report
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Active Tickets</th>
                <th className="px-5 py-3">Resolved Today</th>
                <th className="px-5 py-3">Average Response</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td className="px-5 py-4 font-medium text-slate-900">
                    {agent.name}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{agent.role}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                      {agent.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {agent.activeTickets}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {agent.resolvedToday}
                  </td>
                  <td className="px-5 py-4 text-slate-600">3m 20s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
};

export default ReportsPage;