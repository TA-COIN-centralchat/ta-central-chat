import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import CreateAgentModal from '../components/agents/CreateAgentModal';
import { getAgents } from '../services/ticketService';

const statusOptions = ['All', 'Available', 'Busy', 'Away', 'Offline'];

const roleOptions = [
  'All',
  'Admin',
  'Customer Service Agent',
  'Customer Support Agent',
];

const AgentsPage = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateAgent, setShowCreateAgent] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAgents();
  }, []);

  const filteredAgents = useMemo(() => {
    const searchValue = searchTerm.toLowerCase().trim();

    return agents.filter((agent) => {
      const matchesSearch =
        !searchValue ||
        agent.name?.toLowerCase().includes(searchValue) ||
        agent.email?.toLowerCase().includes(searchValue) ||
        agent.role?.toLowerCase().includes(searchValue) ||
        agent.status?.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === 'All' || agent.status === statusFilter;

      const matchesRole = roleFilter === 'All' || agent.role === roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [agents, searchTerm, statusFilter, roleFilter]);

  const getStatusClass = (status) => {
    if (status === 'Available') {
      return 'bg-emerald-50 text-emerald-700';
    }

    if (status === 'Busy') {
      return 'bg-orange-50 text-orange-700';
    }

    if (status === 'Away') {
      return 'bg-amber-50 text-amber-700';
    }

    return 'bg-slate-100 text-slate-600';
  };

  return (
    <>
      <DashboardLayout
        title="Agents"
        description="Manage customer service and customer support agents."
      >
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-950">
                  Agent Management
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredAgents.length} of {agents.length} agents shown.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateAgent(true)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Create Agent
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px_260px]">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search name, email, role, status..."
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {statusOptions.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>

              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {roleOptions.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading agents...
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-lg font-semibold text-slate-900">
                No agents found
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Try changing your search keyword or filter options.
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
                  {filteredAgents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-slate-50">
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
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
                            agent.status
                          )}`}
                        >
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

      <CreateAgentModal
        open={showCreateAgent}
        onClose={() => setShowCreateAgent(false)}
        onCreated={loadAgents}
      />
    </>
  );
};

export default AgentsPage;