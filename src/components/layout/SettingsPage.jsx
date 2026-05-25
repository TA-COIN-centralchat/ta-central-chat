import DashboardLayout from '../components/layout/DashboardLayout';
import { getCurrentUserRole } from '../routes/ProtectedRoute';

const SettingsPage = () => {
  const currentUserRole = getCurrentUserRole();

  return (
    <DashboardLayout
      title="Settings"
      description="Manage dashboard configuration and system information."
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">
            Account & Role
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
            User roles are controlled by the system. Agents cannot change their
            own role from Settings. In the real system, the role will be loaded
            from the logged-in agent profile created by Admin.
          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <div>
              <span className="font-medium text-slate-900">Current Role:</span>{' '}
              {currentUserRole}
            </div>

            <div className="mt-2">
              <span className="font-medium text-slate-900">Role Source:</span>{' '}
              Temporary frontend role until Supabase Auth is connected.
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">
            Role Access Summary
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Admin creates agent accounts and assigns roles. Agents cannot assign
            or upgrade their own access.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Access</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-5 py-4 font-medium text-slate-900">
                    Admin
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    Full dashboard access, including reports, audit logs,
                    agents, categories, settings, and all ticket operations.
                  </td>
                </tr>

                <tr>
                  <td className="px-5 py-4 font-medium text-slate-900">
                    Customer Service Agent
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    Daily ticket handling, manual ticket creation, waiting
                    queue, Telegram, Website Chatbot, customers, and closed
                    tickets.
                  </td>
                </tr>

                <tr>
                  <td className="px-5 py-4 font-medium text-slate-900">
                    Customer Support Agent
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    Ticket review, pending investigation, customers, and closed
                    tickets.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">
            Future Authentication Flow
          </h2>

          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="rounded-xl bg-slate-50 p-4">
              1. Admin creates an agent account from the Agents page.
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              2. Admin assigns the agent role: Admin, Customer Service Agent, or
              Customer Support Agent.
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              3. Agent logs in using Supabase Auth.
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              4. System reads the saved role from the agent profile and controls
              sidebar/routes automatically.
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;