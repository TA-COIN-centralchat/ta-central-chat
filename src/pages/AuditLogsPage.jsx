import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { supabase } from '../services/supabaseClient';

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAuditLogs = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('audit_logs')
          .select(`
            *,
            tickets (
              ticket_number
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setLogs(data || []);
      } catch (error) {
        console.error('Failed to load audit logs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAuditLogs();
  }, []);

  return (
    <DashboardLayout
      title="Audit Logs"
      description="Track important system and user actions across the Central Chat system."
    >
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="font-semibold text-slate-950">System Activity</h2>
            <p className="mt-1 text-sm text-slate-500">
              View ticket creation, assignment, reassignment, status updates, and agent actions.
            </p>
          </div>

          <input
            placeholder="Search logs..."
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading audit logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-lg font-semibold text-slate-900">
              No audit logs found
            </div>
            <p className="mt-2 text-sm text-slate-500">
              System activity will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Ticket</th>
                  <th className="px-5 py-3">Details</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {new Date(log.created_at).toLocaleString()}
                    </td>

                    <td className="px-5 py-4 font-medium text-slate-900">
                      {log.user_name || 'System'}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {log.role || 'System'}
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                        {log.action}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {log.tickets?.ticket_number || 'N/A'}
                    </td>

                    <td className="max-w-lg px-5 py-4 text-slate-600">
                      {log.details || 'No details provided.'}
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

export default AuditLogsPage;