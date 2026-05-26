import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

import DashboardLayout from "../components/layout/DashboardLayout";
import { createAgent, getAgents } from "../services/ticketService";

const roleOptions = [
  "Admin",
  "Customer Service Agent",
  "Customer Support Agent",
];

const initialFormData = {
  fullName: "",
  email: "",
  role: "Customer Service Agent",
  password: "",
};

const AgentsPage = () => {
  const [agents, setAgents] = useState([]);
  const [formData, setFormData] = useState(initialFormData);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadAgents = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const data = await getAgents();
      setAgents(data || []);
    } catch (error) {
      console.error("Failed to load agents:", error);
      setErrorMessage(
        error?.message || "Failed to load agents. Please check Supabase.",
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
      (agent) => agent.status?.toLowerCase() === "available",
    ).length;

    const busy = agents.filter(
      (agent) => agent.status?.toLowerCase() === "busy",
    ).length;

    const offline = agents.filter(
      (agent) => agent.status?.toLowerCase() === "offline",
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

    if (successMessage) setSuccessMessage("");
    if (errorMessage) setErrorMessage("");
  };

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.fullName.trim()) {
      setErrorMessage("Please enter the agent full name.");
      return false;
    }

    if (!formData.email.trim()) {
      setErrorMessage("Please enter the agent email.");
      return false;
    }

    if (!emailRegex.test(formData.email.trim())) {
      setErrorMessage("Please enter a valid email address.");
      return false;
    }

    if (!formData.role) {
      setErrorMessage("Please select the agent role.");
      return false;
    }

    if (!formData.password || formData.password.length < 8) {
      setErrorMessage("Temporary password must be at least 8 characters.");
      return false;
    }

    return true;
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setShowPassword(false);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleCreateAgent = async (event) => {
    event.preventDefault();

    setSuccessMessage("");
    setErrorMessage("");

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
        `Agent account created successfully. ${formData.fullName} can now log in with ${formData.email}.`,
      );

      setFormData(initialFormData);
      setShowForm(false);
      await loadAgents();
    } catch (error) {
      console.error("Create agent error:", error);

      setErrorMessage(
        error?.message ||
          "Failed to create agent. Please check the Edge Function logs in Supabase.",
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
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-linear-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-sm">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-blue-100">
                <ShieldCheck size={14} />
                Agent Management
              </div>

              <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
                Manage support team access
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Admin can create real login accounts for agents. The system uses
                Supabase Auth and links each login account to an agent profile.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniMetric label="Total" value={stats.total} />
              <MiniMetric label="Available" value={stats.available} />
              <MiniMetric label="Busy" value={stats.busy} />
              <MiniMetric label="Offline" value={stats.offline} />
            </div>
          </div>
        </section>

        {successMessage && (
          <AlertBox
            type="success"
            icon={CheckCircle}
            message={successMessage}
          />
        )}

        {errorMessage && (
          <AlertBox type="error" icon={AlertCircle} message={errorMessage} />
        )}

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Agent Accounts
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Create agents with email, password, and role-based permissions.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 h-10 px-3.5">
                <Search size={17} className="text-slate-400" />

                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search agents..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 sm:w-56"
                />
              </div>

              <button
                type="button"
                onClick={loadAgents}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                <Plus size={16} />
                Create Agent
              </button>
            </div>
          </div>

          {showForm && (
            <form
              onSubmit={handleCreateAgent}
              className="border-b border-slate-200 bg-slate-50 p-5"
            >
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <UserPlus size={19} />
                </div>

                <div>
                  <h3 className="font-semibold text-slate-950">
                    Create New Agent Login
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
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
                  onChange={(value) => handleChange("fullName", value)}
                />

                <Input
                  label="Email"
                  required
                  type="email"
                  placeholder="agent@tacoin.com"
                  value={formData.email}
                  onChange={(value) => handleChange("email", value)}
                />

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Role <span className="text-red-500">*</span>
                  </label>

                  <select
                    value={formData.role}
                    onChange={(event) =>
                      handleChange("role", event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white h-10 px-3.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Temporary Password <span className="text-red-500">*</span>
                  </label>

                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white h-10 px-3.5 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(event) =>
                        handleChange("password", event.target.value)
                      }
                      placeholder="Minimum 8 characters"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
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
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Create Agent Login
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Agent</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Active Tickets</th>
                    <th className="px-5 py-3">Resolved Today</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 w-full rounded bg-slate-100"></div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredAgents.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Agent</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Active Tickets</th>
                    <th className="px-5 py-3">Resolved Today</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredAgents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-700">
                            {getInitials(agent.name)}
                          </div>

                          <div>
                            <div className="font-semibold text-slate-900">
                              {agent.name}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              Agent ID: {agent.id?.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Mail size={15} className="text-slate-400" />
                          {agent.email}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                          {agent.role}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${getStatusClass(
                            agent.status,
                          )}`}
                        >
                          {agent.status || "Offline"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {agent.activeTickets || 0}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
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

const MiniMetric = ({ label, value }) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-300">{label}</div>
    </div>
  );
};

const AlertBox = ({ type, icon: Icon, message }) => {
  const classes = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    error: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <div
      className={`flex gap-3 rounded-2xl border p-4 text-sm ${classes[type]}`}
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
  type = "text",
  required = false,
}) => {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white h-10 px-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
      />
    </div>
  );
};

const EmptyState = () => {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Users size={22} />
      </div>

      <h3 className="mt-4 font-semibold text-slate-900">No agents found</h3>

      <p className="mt-2 text-sm text-slate-500">
        Create your first support agent using the Create Agent button.
      </p>
    </div>
  );
};

const getInitials = (name = "") => {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const getStatusClass = (status) => {
  const normalized = status?.toLowerCase().trim();

  if (normalized === "available") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }

  if (normalized === "busy") {
    return "bg-orange-50 text-orange-700 ring-orange-100";
  }

  if (normalized === "away") {
    return "bg-amber-50 text-amber-700 ring-amber-100";
  }

  return "bg-slate-100 text-slate-600 ring-slate-200";
};

export default AgentsPage;
