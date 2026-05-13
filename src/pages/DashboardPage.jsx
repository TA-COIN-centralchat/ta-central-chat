import DashboardLayout from '../components/layout/DashboardLayout';
import { tickets, agents } from '../data/mockData';

const stats = [
  { label: 'Total Tickets', value: 24 },
  { label: 'New Tickets', value: 6 },
  { label: 'In Progress', value: 7 },
  { label: 'Waiting Queue', value: 5 },
  { label: 'Pending Investigation', value: 3 },
  { label: 'Resolved Today', value: 9 },
  { label: 'Available Agents', value: 2 },
  { label: 'Avg Response Time', value: '3m' },
];

const DashboardPage = () => {
  return (
    <DashboardLayout
      title="Dashboard"
      description="Overview of T.A Coin Central Chat support operations."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="text-sm text-slate-500">{stat.label}</div>
            <div className="mt-3 text-3xl font-semibold text-slate-950">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_380px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Recent Tickets</h2>
          <div className="mt-4 space-y-3">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-4"
              >
                <div>
                  <div className="font-medium text-slate-900">{ticket.id}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {ticket.customer} · {ticket.channel} · {ticket.category}
                  </div>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                  {ticket.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Agent Status</h2>
          <div className="mt-4 space-y-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-xl border border-slate-100 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">
                      {agent.name}
                    </div>
                    <div className="text-sm text-slate-500">{agent.role}</div>
                  </div>

                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                    {agent.status}
                  </span>
                </div>

                <div className="mt-3 text-sm text-slate-500">
                  Active tickets: {agent.activeTickets} · Resolved today:{' '}
                  {agent.resolvedToday}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;