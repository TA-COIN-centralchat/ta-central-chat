import DashboardLayout from '../components/layout/DashboardLayout';
import { getCurrentUserRole } from '../routes/ProtectedRoute';

const SettingsPage = () => {
  const currentUserRole = getCurrentUserRole();

  return (
    <DashboardLayout
      title="Settings"
      description="Manage dashboard configuration and system information."
    >
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[28px] border border-[#e8edf2] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-[#d8eef7]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-base font-semibold text-[#1d1d1f]">
                Account & Role
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#6e6e73]">
                User roles are controlled by the system. Agents cannot change
                their own role from Settings. In the real system, the role will
                be loaded from the logged-in agent profile created by Admin.
              </p>
            </div>

            <div className="w-full rounded-3xl border border-[#d8eef7] bg-[#f7fbfd] p-4 lg:max-w-sm">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-[#8e8e93]">
                Current Role
              </div>

              <div className="mt-2 text-lg font-semibold text-[#1d1d1f]">
                {currentUserRole || 'No role found'}
              </div>

              <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-[#6e6e73] ring-1 ring-[#e8edf2]">
                Role source: Temporary frontend role until Supabase Auth is
                connected.
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#e8edf2] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-[#1d1d1f]">
              Role Access Summary
            </h2>

            <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
              Admin creates agent accounts and assigns roles. Agents cannot
              assign or upgrade their own access.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <RoleCard
              role="Admin"
              access="Full dashboard access, including reports, audit logs, agents, categories, settings, and all ticket operations."
              highlight
            />

            <RoleCard
              role="Customer Service Agent"
              access="Daily ticket handling, manual ticket creation, waiting queue, Telegram, Website Chatbot, customers, and closed tickets."
            />

            <RoleCard
              role="Customer Support Agent"
              access="Ticket review, pending investigation, customers, and closed tickets."
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-[#e8edf2] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-[#1d1d1f]">
              Future Authentication Flow
            </h2>

            <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
              Planned production flow for account creation, login, and
              role-based access.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FlowStep
              number="1"
              title="Create Agent"
              description="Admin creates an agent account from the Agents page."
            />

            <FlowStep
              number="2"
              title="Assign Role"
              description="Admin assigns Admin, Customer Service Agent, or Customer Support Agent."
            />

            <FlowStep
              number="3"
              title="Agent Login"
              description="Agent logs in using Supabase Auth."
            />

            <FlowStep
              number="4"
              title="Access Control"
              description="System reads the saved role and controls sidebar/routes automatically."
            />
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

const RoleCard = ({ role, access, highlight = false }) => {
  return (
    <div
      className={`rounded-3xl border p-4 transition-all duration-200 hover:-translate-y-0.5 ${
        highlight
          ? 'border-[#d8eef7] bg-[#f7fbfd] shadow-[0_14px_32px_rgba(67,172,214,0.10)]'
          : 'border-[#e8edf2] bg-[#fbfbfd] hover:border-[#d8eef7] hover:bg-white'
      }`}
    >
      <div
        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1 ${
          highlight
            ? 'bg-white text-[#2389b8] ring-[#d8eef7]'
            : 'bg-white text-[#6e6e73] ring-[#e8edf2]'
        }`}
      >
        {role}
      </div>

      <p className="mt-4 text-sm leading-6 text-[#6e6e73]">{access}</p>
    </div>
  );
};

const FlowStep = ({ number, title, description }) => {
  return (
    <div className="rounded-3xl border border-[#e8edf2] bg-[#fbfbfd] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d8eef7] hover:bg-white hover:shadow-[0_14px_32px_rgba(67,172,214,0.08)]">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-[#2389b8] ring-1 ring-[#d8eef7]">
        {number}
      </div>

      <h3 className="mt-4 text-sm font-semibold text-[#1d1d1f]">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-[#6e6e73]">{description}</p>
    </div>
  );
};

export default SettingsPage;