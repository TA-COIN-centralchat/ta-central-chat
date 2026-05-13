import DashboardLayout from '../components/layout/DashboardLayout';

const SettingsPage = () => {
  return (
    <DashboardLayout
      title="Settings"
      description="Configure ticket rules, channels, and agent settings."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          'Auto Assignment Rules',
          'Channel Settings',
          'Ticket Status Settings',
          'Customer Information Fields',
          'Notification Settings',
          'Realtime Connection',
        ].map((title) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <h2 className="font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">
              Configure {title.toLowerCase()} for the Central Chat system.
            </p>

            <button className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">
              Manage
            </button>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;