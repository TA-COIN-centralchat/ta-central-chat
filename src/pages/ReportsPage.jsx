import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { getAgents, getTickets } from '../services/ticketService';

const ReportsPage = () => {
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReports = async () => {
      try {
        setLoading(true);

        const [ticketData, agentData] = await Promise.all([
          getTickets(),
          getAgents(),
        ]);

        setTickets(ticketData);
        setAgents(agentData);
      } catch (error) {
        console.error('Failed to load reports:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, []);

  const countByStatus = (status) =>
    tickets.filter((ticket) => ticket.status === status).length;

  const channelStats = Object.values(
    tickets.reduce((acc, ticket) => {
      const key = ticket.channel || 'Unknown';

      if (!acc[key]) {
        acc[key] = {
          channel: key,
          tickets: 0,
        };
      }

      acc[key].tickets += 1;
      return acc;
    }, {})
  );

  const issueStats = Object.values(
    tickets.reduce((acc, ticket) => {
      const key = ticket.category || 'Other';

      if (!acc[key]) {
        acc[key] = {
          issue: key,
          tickets: 0,
        };
      }

      acc[key].tickets += 1;
      return acc;
    }, {})
  );

  const reportCards = [
    { label: 'Total Tickets', value: tickets.length },
    { label: 'New Tickets', value: countByStatus('New') },
    { label: 'Assigned', value: countByStatus('Assigned') },
    { label: 'In Progress', value: countByStatus('In Progress') },
    { label: 'Pending Investigation', value: countByStatus('Pending Investigation') },
    {
      label: 'Resolved / Closed',
      value: tickets.filter(
        (ticket) => ticket.status === 'Resolved' || ticket.status === 'Closed'
      ).length,
    },
  ];

  return (
    <DashboardLayout
      title="Reports"
      description="Monitor ticket volume, channel usage, and agent performance."
    >
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          Loading reports...
        </div>
      ) : (
        <>
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
                {channelStats.length === 0 ? (
                  <Empty text="No channel data available." />
                ) : (
                  channelStats.map((item) => {
                    const percentage =
                      tickets.length > 0 ? (item.tickets / tickets.length) * 100 : 0;

                    return (
                      <ProgressRow
                        key={item.channel}
                        label={item.channel}
                        value={item.tickets}
                        percentage={percentage}
                        color="bg-blue-600"
                      />
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-950">Tickets by Issue Type</h2>

              <div className="mt-5 space-y-4">
                {issueStats.length === 0 ? (
                  <Empty text="No issue type data available." />
                ) : (
                  issueStats.map((item) => {
                    const percentage =
                      tickets.length > 0 ? (item.tickets / tickets.length) * 100 : 0;

                    return (
                      <ProgressRow
                        key={item.issue}
                        label={item.issue}
                        value={item.tickets}
                        percentage={percentage}
                        color="bg-emerald-600"
                      />
                    );
                  })
                )}
              </div>
            </section>
          </div>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="font-semibold text-slate-950">Agent Performance</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Overview of active tickets and assigned tickets by agent.
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
                    <th className="px-5 py-3">Assigned Tickets</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {agents.map((agent) => {
                    const assignedTickets = tickets.filter(
                      (ticket) => ticket.assignedTo === agent.name
                    ).length;

                    return (
                      <tr key={agent.id}>
                        <td className="px-5 py-4 font-medium text-slate-900">
                          {agent.name}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {agent.role}
                        </td>
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
                        <td className="px-5 py-4 text-slate-600">
                          {assignedTickets}
                        </td>
                      </tr>
                    );
                  })}

                  {agents.length === 0 && (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-5 py-10 text-center text-sm text-slate-500"
                      >
                        No agents found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </DashboardLayout>
  );
};

const ProgressRow = ({ label, value, percentage, color }) => (
  <div>
    <div className="mb-2 flex justify-between text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <span className="text-slate-500">{value}</span>
    </div>

    <div className="h-3 rounded-full bg-slate-100">
      <div
        className={`h-3 rounded-full ${color}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  </div>
);

const Empty = ({ text }) => (
  <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
    {text}
  </div>
);

export default ReportsPage;