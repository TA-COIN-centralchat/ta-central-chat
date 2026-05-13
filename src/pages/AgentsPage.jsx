import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { getAgents } from '../services/ticketService';

const AgentsPage = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoading(true);
        const data = await getAgents();
        setAgents(data);
      } catch (error) {
        console.error('Failed to load agents:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAgents();
  }, []);

  return (
    <DashboardLayout
      title="Agents"
      description="Manage customer service and customer support agents."
    >
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="font-semibold text-slate-950">Agent Management</h2>
            <p className="mt-1 text-sm text-slate-500">
              Agent data is now loaded from Supabase.
            </p>
          </div>

          <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Create Agent
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading agents...
          </div>
        ) : agents.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-lg font-semibold text-slate-900">
              No agents found
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Agents from Supabase will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Agent</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Active Tickets</th>
                  <th className="px-5 py-3">Resolved Today</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {agents.map((agent) => (
                  <tr key={agent.id}>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {agent.name}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {agent.role}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {agent.email}
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

export default AgentsPage;