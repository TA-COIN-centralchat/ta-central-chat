import {
  CheckCircle,
  KeyRound,
  Lock,
  Settings,
  ShieldCheck,
  UserCog,
} from 'lucide-react';

import DashboardLayout from '../components/layout/DashboardLayout';
import { getCurrentUserRole } from '../utils/authUtils';

const SettingsPage = () => {
  const currentUserRole = getCurrentUserRole();

  return (
    <DashboardLayout
      title="Settings"
      description="Manage dashboard configuration and system information."
    >
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-[28px] border border-black/6 bg-white/90 shadow-[0_14px_40px_rgba(0,0,0,0.035)] backdrop-blur">
          <div className="flex flex-col justify-between gap-4 border-b border-black/6 px-5 py-4 lg:flex-row lg:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8] ring-1 ring-[#43acd6]/15">
                <Settings size={19} />
              </div>

              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">
                  System Settings
                </h2>

                <p className="mt-1 max-w-3xl text-sm leading-6 text-[#6e6e73]">
                  Review account access, role permissions, and authentication
                  flow for the Central Chat dashboard.
                </p>
              </div>
            </div>

          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] border border-black/6 bg-white/90 p-5 shadow-[0_14px_40px_rgba(0,0,0,0.035)] backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8] ring-1 ring-[#43acd6]/15">
                <UserCog size={19} />
              </div>

              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">
                  Account & Role
                </h2>

                <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
                  User roles are controlled by the system. Agents cannot change
                  their own role from Settings.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <InfoRow
                label="Current Role"
                value={currentUserRole || 'No role found'}
                highlight
              />

              <InfoRow
                label="Role Source"
                value="Temporary frontend role until Supabase Auth is connected."
              />
            </div>

            <div className="mt-5 rounded-[22px] border border-[#43acd6]/15 bg-[#eef9fd] p-4 text-sm leading-6 text-[#2389b8]">
              In the real system, the role will be loaded from the logged-in
              agent profile created by Admin.
            </div>
          </div>

          <div className="rounded-[28px] border border-black/6 bg-white/90 p-5 shadow-[0_14px_40px_rgba(0,0,0,0.035)] backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <ShieldCheck size={19} />
              </div>

              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">
                  Access Control
                </h2>

                <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
                  Admin creates agent accounts and assigns roles. Agents cannot
                  assign or upgrade their own access.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <AccessMiniCard label="Admin" value="Full Access" />
              <AccessMiniCard label="Service Agent" value="Operations" />
              <AccessMiniCard label="Support Agent" value="Review" />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-black/6 bg-white/90 shadow-[0_14px_40px_rgba(0,0,0,0.035)] backdrop-blur">
          <div className="border-b border-black/6 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8] ring-1 ring-[#43acd6]/15">
                <Lock size={19} />
              </div>

              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">
                  Role Access Summary
                </h2>

                <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
                  A quick overview of what each role can access inside the
                  Central Chat dashboard.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-205 table-fixed text-left text-sm">
              <colgroup>
                <col className="w-65" />
                <col />
              </colgroup>

              <thead className="bg-[#f5f5f7] text-[11px] uppercase tracking-[0.16em] text-[#8e8e93]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Access</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-black/5">
                <RoleRow
                  role="Admin"
                  badgeTone="blue"
                  access="Full dashboard access, including reports, audit logs, agents, categories, settings, and all ticket operations."
                />

                <RoleRow
                  role="Customer Service Agent"
                  badgeTone="green"
                  access="Daily ticket handling, manual ticket creation, waiting queue, Telegram, Website Chatbot, customers, and closed tickets."
                />

                <RoleRow
                  role="Customer Support Agent"
                  badgeTone="slate"
                  access="Ticket review, pending investigation, customers, and closed tickets."
                />
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[28px] border border-black/6 bg-white/90 p-5 shadow-[0_14px_40px_rgba(0,0,0,0.035)] backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8] ring-1 ring-[#43acd6]/15">
              <KeyRound size={19} />
            </div>

            <div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">
                Future Authentication Flow
              </h2>

              <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
                The intended production login and role management process.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
              description="Agent logs in using Supabase Auth credentials."
            />

            <FlowStep
              number="4"
              title="Role Control"
              description="System reads the saved role and controls sidebar/routes automatically."
            />
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

const InfoRow = ({ label, value, highlight = false }) => {
  return (
    <div className="rounded-[22px] border border-black/6 bg-[#f5f5f7] p-4">
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-[#8e8e93]">
        {label}
      </div>

      <div
        className={`mt-2 text-sm font-semibold ${
          highlight ? 'text-[#2389b8]' : 'text-[#1d1d1f]'
        }`}
      >
        {value}
      </div>
    </div>
  );
};

const AccessMiniCard = ({ label, value }) => {
  return (
    <div className="rounded-[22px] border border-black/6 bg-[#f5f5f7] p-4">
      <div className="text-xs text-[#8e8e93]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[#1d1d1f]">{value}</div>
    </div>
  );
};

const RoleRow = ({ role, access, badgeTone }) => {
  const tones = {
    blue: 'bg-[#eef9fd] text-[#2389b8] ring-[#43acd6]/15',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  };

  return (
    <tr className="transition hover:bg-[#f8fafc]">
      <td className="px-5 py-4">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1 ${tones[badgeTone]}`}
        >
          {role}
        </span>
      </td>

      <td className="px-5 py-4">
        <div className="max-w-4xl text-sm leading-6 text-[#6e6e73]">
          {access}
        </div>
      </td>
    </tr>
  );
};

const FlowStep = ({ number, title, description }) => {
  return (
    <div className="rounded-3xl border border-black/6 bg-[#f5f5f7] p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-[#2389b8] ring-1 ring-[#43acd6]/15">
        {number}
      </div>

      <h3 className="mt-4 text-sm font-semibold text-[#1d1d1f]">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-[#6e6e73]">{description}</p>

      <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-700">
        <CheckCircle size={14} />
        Planned flow
      </div>
    </div>
  );
};

export default SettingsPage;