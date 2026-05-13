import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { getAgents, getTickets } from '../services/ticketService';

const DashboardPage = () => {
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);

        const [ticketData, agentData] = await Promise.all([
          getTickets(),
          getAgents(),
        ]);

        setTickets(ticketData);
        setAgents(agentData);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const stats = [
    {
      label: 'Total Tickets',
      value: tickets.length,
    },
    {
      label: 'New Tickets',
      value: tickets.filter((ticket) => ticket.status === 'New').length,
    },
    {
      label: 'In Progress',
      value: tickets.filter((ticket) => ticket.status === 'In Progress').length,
    },
    {
      label: 'Waiting Queue',
      value: tickets.filter(
        (ticket) => ticket.status === 'New' || ticket.assignedTo === 'Unassigned'
      ).length,
    },
    {
      label: 'Pending Investigation',
      value: tickets.filter(
        (ticket) => ticket.status === 'Pending Investigation'
      ).length,
    },
    {
      label: 'Resolved / Closed',
      value: tickets.filter(
        (ticket) => ticket.status === 'Resolved' || ticket.status === 'Closed'
      ).length,
    },
    {
      label: 'Available Agents',
      value: agents.filter((agent) => agent.status === 'Available').length,
    },
    {
      label: 'Busy Agents',
      value: agents.filter((agent) => agent.status === 'Busy').length,
    },
  ];

  return (
    <DashboardLayout
      title="Dashboard"
      description="Overview of T.A Coin Central Chat support operations."
    >
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          Loading dashboard data...
        </div>
      ) : (
        <>
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
                {tickets.slice(0, 6).map((ticket) => (
                  <div
                    key={ticket.dbId}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-4"
                  >
                    <div>
                      <div className="font-medium text-slate-900">
                        {ticket.id}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {ticket.customer} · {ticket.channel} · {ticket.category}
                      </div>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      {ticket.status}
                    </span>
                  </div>
                ))}

                {tickets.length === 0 && (
                  <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                    No recent tickets found.
                  </div>
                )}
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
                        <div className="text-sm text-slate-500">
                          {agent.role}
                        </div>
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

                {agents.length === 0 && (
                  <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                    No agents found.
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

export default DashboardPage;