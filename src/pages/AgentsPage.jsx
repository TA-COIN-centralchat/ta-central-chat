import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';

import DashboardLayout from '../components/layout/DashboardLayout';
import { createAgent, getAgents } from '../services/ticketService';

const roleOptions = ['Admin', 'Customer Service Agent', 'Customer Support Agent'];

const initialFormData = {
  fullName: '',
  email: '',
  role: 'Customer Service Agent',
  password: '',
};

const AgentsPage = () => {
  const [agents, setAgents] = useState([]);
  const [formData, setFormData] = useState(initialFormData);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadAgents = async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      const data = await getAgents();
      setAgents(data || []);
    } catch (error) {
      console.error('Failed to load agents:', error);
      setErrorMessage(
        error?.message || 'Failed to load agents. Please check Supabase.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAgents();
  }, []);

  const filteredAgents = useMemo(() => {
    const keyword = searchTerm.toLowerCase().trim();

    if (!keyword) return agents;

    return agents.filter((agent) => {
      return (
        agent.name?.toLowerCase().includes(keyword) ||
        agent.email?.toLowerCase().includes(keyword) ||
        agent.role?.toLowerCase().includes(keyword) ||
        agent.status?.toLowerCase().includes(keyword)
      );
    });
  }, [agents, searchTerm]);

  const stats = useMemo(() => {
    const available = agents.filter(
      (agent) => agent.status?.toLowerCase() === 'available'
    ).length;

    const busy = agents.filter(
      (agent) => agent.status?.toLowerCase() === 'busy'
    ).length;

    const offline = agents.filter(
      (agent) => agent.status?.toLowerCase() === 'offline'
    ).length;

    return {
      total: agents.length,
      available,
      busy,
      offline,
    };
  }, [agents]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (successMessage) setSuccessMessage('');
    if (errorMessage) setErrorMessage('');
  };

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.fullName.trim()) {
      setErrorMessage('Please enter the agent full name.');
      return false;
    }

    if (!formData.email.trim()) {
      setErrorMessage('Please enter the agent email.');
      return false;
    }

    if (!emailRegex.test(formData.email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return false;
    }

    if (!formData.role) {
      setErrorMessage('Please select the agent role.');
      return false;
    }

    if (!formData.password || formData.password.length < 8) {
      setErrorMessage('Temporary password must be at least 8 characters.');
      return false;
    }

    return true;
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setShowPassword(false);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleCreateAgent = async (event) => {
    event.preventDefault();

    setSuccessMessage('');
    setErrorMessage('');

    if (!validateForm()) return;

    try {
      setCreating(true);

      await createAgent({
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
        password: formData.password,
      });

      setSuccessMessage(
        `Agent account created successfully. ${formData.fullName} can now log in with ${formData.email}.`
      );

      setFormData(initialFormData);
      setShowForm(false);
      await loadAgents();
    } catch (error) {
      console.error('Create agent error:', error);

      setErrorMessage(
        error?.message ||
          'Failed to create agent. Please check the Edge Function logs in Supabase.'
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout
      title="Agents"
      description="Create and manage agent accounts, roles, and availability."
    >
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Agents" value={stats.total} tone="blue" />
          <MetricCard label="Available" value={stats.available} tone="green" />
          <MetricCard label="Busy" value={stats.busy} tone="orange" />
          <MetricCard label="Offline" value={stats.offline} tone="slate" />
        </section>

        {successMessage && (
          <AlertBox type="success" icon={CheckCircle} message={successMessage} />
        )}

        {errorMessage && (
          <AlertBox type="error" icon={AlertCircle} message={errorMessage} />
        )}

        <section className="rounded-[28px] border border-black/6 bg-white/85 shadow-[0_16px_50px_rgba(0,0,0,0.04)] backdrop-blur">
          <div className="flex flex-col justify-between gap-4 border-b border-black/6 p-5 lg:flex-row lg:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
                <ShieldCheck size={19} />
              </div>

              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">
                  Agent Accounts
                </h2>

                <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
                  Create agents with email, password, and role-based
                  permissions.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="system-input flex items-center gap-3 rounded-2xl px-4 py-3">
                <Search size={17} className="text-[#8e8e93]" />

                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search agents..."
                  className="w-full bg-transparent text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93] sm:w-56"
                />
              </div>

              <button
                type="button"
                onClick={loadAgents}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/[0.07] bg-[#f5f5f7] px-4 py-3 text-sm font-medium text-[#6e6e73] transition hover:bg-white hover:text-[#1d1d1f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Refresh
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForm((prev) => !prev);
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#43acd6] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.22)] transition hover:bg-[#2389b8]"
              >
                <Plus size={16} />
                Create Agent
              </button>
            </div>
          </div>

          {showForm && (
            <form
              onSubmit={handleCreateAgent}
              className="border-b border-black/6 bg-[#fbfbfd] p-5"
            >
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
                  <UserPlus size={19} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#1d1d1f]">
                    Create New Agent Login
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
                    This creates both a Supabase Auth user and an agent profile.
                    The agent can log in immediately using the email and
                    temporary password.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Full Name"
                  required
                  placeholder="Example: Agent Lina"
                  value={formData.fullName}
                  onChange={(value) => handleChange('fullName', value)}
                />

                <Input
                  label="Email"
                  required
                  type="email"
                  placeholder="agent@tacoin.com"
                  value={formData.email}
                  onChange={(value) => handleChange('email', value)}
                />

                <div>
                  <label className="text-sm font-medium text-[#1d1d1f]">
                    Role <span className="text-red-500">*</span>
                  </label>

                  <select
                    value={formData.role}
                    onChange={(event) =>
                      handleChange('role', event.target.value)
                    }
                    className="system-input mt-2 w-full rounded-2xl px-4 py-3 text-sm text-[#1d1d1f] outline-none"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#1d1d1f]">
                    Temporary Password{' '}
                    <span className="text-red-500">*</span>
                  </label>

                  <div className="system-input mt-2 flex items-center gap-3 rounded-2xl px-4 py-3">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(event) =>
                        handleChange('password', event.target.value)
                      }
                      placeholder="Minimum 8 characters"
                      className="w-full bg-transparent text-sm text-[#1d1f1d] outline-none placeholder:text-[#8e8e93]"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="rounded-xl p-1.5 text-[#8e8e93] transition hover:bg-white hover:text-[#1d1d1f]"
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-[#6e6e73]">
                    Use at least 8 characters. Example: Lina123456
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col-reverse justify-end gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  disabled={creating}
                  className="rounded-2xl border border-black/8 bg-white px-5 py-3 text-sm font-medium text-[#6e6e73] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#43acd6] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.22)] transition hover:bg-[#2389b8] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Agent Login
                      <UserPlus size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex min-h-60 items-center justify-center p-10 text-sm text-[#6e6e73]">
              <div className="text-center">
                <Loader2
                  size={26}
                  className="mx-auto mb-3 animate-spin text-[#43acd6]"
                />
                Loading agents...
              </div>
            </div>
          ) : filteredAgents.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f5f5f7] text-xs uppercase tracking-[0.16em] text-[#8e8e93]">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Agent</th>
                    <th className="px-5 py-4 font-semibold">Email</th>
                    <th className="px-5 py-4 font-semibold">Role</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Active Tickets</th>
                    <th className="px-5 py-4 font-semibold">Resolved Today</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-black/5">
                  {filteredAgents.map((agent) => (
                    <tr
                      key={agent.id}
                      className="transition hover:bg-[#f8fafc]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef9fd] text-sm font-semibold text-[#2389b8] ring-1 ring-[#43acd6]/10">
                            {getInitials(agent.name)}
                          </div>

                          <div>
                            <div className="font-semibold text-[#1d1d1f]">
                              {agent.name}
                            </div>

                            <div className="mt-1 text-xs text-[#8e8e93]">
                              Agent ID: {agent.id?.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-[#6e6e73]">
                          <Mail size={15} className="text-[#8e8e93]" />
                          {agent.email}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-[#eef9fd] px-3 py-1 text-xs font-medium text-[#2389b8] ring-1 ring-[#43acd6]/15">
                          {agent.role}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${getStatusClass(
                            agent.status
                          )}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${getStatusDotClass(
                              agent.status
                            )}`}
                          />
                          {agent.status || 'Offline'}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-[#6e6e73]">
                        {agent.activeTickets || 0}
                      </td>

                      <td className="px-5 py-4 text-[#6e6e73]">
                        {agent.resolvedToday || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

const MetricCard = ({ label, value, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-[#eef9fd] text-[#2389b8] ring-[#43acd6]/15',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    orange: 'bg-orange-50 text-orange-700 ring-orange-100',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  };

  return (
    <div className="rounded-[26px] border border-black/0.06 bg-white/85 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.04)] backdrop-blur">
      <div
        className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ${tones[tone]}`}
      >
        <Users size={18} />
      </div>

      <div className="text-3xl font-semibold tracking-[-0.04em] text-[#1d1d1f]">
        {value}
      </div>

      <div className="mt-1 text-sm text-[#6e6e73]">{label}</div>
    </div>
  );
};

const AlertBox = ({ type, icon: Icon, message }) => {
  const classes = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    error: 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <div
      className={`flex gap-3 rounded-2xl border px-4 py-3 text-sm ${classes[type]}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <p className="leading-6">{message}</p>
    </div>
  );
};

const Input = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
}) => {
  return (
    <div>
      <label className="text-sm font-medium text-[#1d1d1f]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="system-input mt-2 w-full rounded-2xl px-4 py-3 text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
      />
    </div>
  );
};

const EmptyState = () => {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
        <Users size={22} />
      </div>

      <h3 className="mt-4 font-semibold text-[#1d1d1f]">No agents found</h3>

      <p className="mt-2 text-sm text-[#6e6e73]">
        Create your first support agent using the Create Agent button.
      </p>
    </div>
  );
};

const getInitials = (name = '') => {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
};

const getStatusClass = (status) => {
  const normalized = status?.toLowerCase().trim();

  if (normalized === 'available') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  }

  if (normalized === 'busy') {
    return 'bg-orange-50 text-orange-700 ring-orange-100';
  }

  if (normalized === 'away') {
    return 'bg-amber-50 text-amber-700 ring-amber-100';
  }

  return 'bg-slate-100 text-slate-600 ring-slate-200';
};

const getStatusDotClass = (status) => {
  const normalized = status?.toLowerCase().trim();

  if (normalized === 'available') {
    return 'bg-emerald-500';
  }

  if (normalized === 'busy') {
    return 'bg-orange-500';
  }

  if (normalized === 'away') {
    return 'bg-amber-500';
  }

  return 'bg-slate-400';
};

export default AgentsPage;