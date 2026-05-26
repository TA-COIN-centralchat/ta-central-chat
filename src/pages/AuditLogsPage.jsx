import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import { supabase } from "../services/supabaseClient";

const actionFilters = [
  "All",
  "Ticket Auto Assigned",
  "Ticket Created In Queue",
  "Queue Ticket Auto Assigned",
  "Ticket Reassigned",
  "Agent Created",
  "Category Created",
  "Ticket Status Updated to Resolved",
  "Ticket Status Updated to Pending Investigation",
];

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("All");

  useEffect(() => {
    const loadAuditLogs = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("audit_logs")
          .select(
            `
            *,
            tickets (
              ticket_number
            )
          `,
          )
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        setLogs(data || []);
      } catch (error) {
        console.error("Failed to load audit logs:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAuditLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    const searchValue = searchTerm.toLowerCase().trim();

    return logs.filter((log) => {
      const ticketNumber = log.tickets?.ticket_number || "";

      const matchesSearch =
        !searchValue ||
        log.user_name?.toLowerCase().includes(searchValue) ||
        log.role?.toLowerCase().includes(searchValue) ||
        log.action?.toLowerCase().includes(searchValue) ||
        log.details?.toLowerCase().includes(searchValue) ||
        ticketNumber.toLowerCase().includes(searchValue);

      const matchesAction =
        actionFilter === "All" || log.action === actionFilter;

      return matchesSearch && matchesAction;
    });
  }, [logs, searchTerm, actionFilter]);

  return (
    <DashboardLayout
      title="Audit Logs"
      description="Track important system and user actions across the Central Chat system."
    >
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-950">System Activity</h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredLogs.length} of {logs.length} audit logs shown.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 h-10 px-3 transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50">
              <Search size={16} className="text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search user, role, action, ticket number, details..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>

            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              className="rounded-xl border border-slate-200 h-10 px-3 text-sm outline-none focus:border-blue-500 md:w-80"
            >
              {actionFilters.map((action) => (
                <option key={action}>{action}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
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
        ) : filteredLogs.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-lg font-semibold text-slate-900">
              No audit logs found
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Try changing your search keyword or action filter.
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
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString()
                        : "N/A"}
                    </td>

                    <td className="px-5 py-4 font-medium text-slate-900">
                      {log.user_name || "System"}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {log.role || "System"}
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                        {log.action}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {log.tickets?.ticket_number || "N/A"}
                    </td>

                    <td className="max-w-xl px-5 py-4 text-slate-600">
                      {log.details || "No details provided."}
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
