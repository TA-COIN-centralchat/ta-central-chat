import { useEffect, useMemo, useState } from 'react';
import { Clock, Loader2, Search, ShieldCheck } from 'lucide-react';

import DashboardLayout from '../components/layout/DashboardLayout';
import { supabase } from '../services/supabaseClient';

const actionFilters = [
  'All',
  'Ticket Auto Assigned',
  'Ticket Created In Queue',
  'Queue Ticket Auto Assigned',
  'Ticket Reassigned',
  'Agent Created',
  'Category Created',
  'Ticket Status Updated to Resolved',
  'Ticket Status Updated to Pending Investigation',
];

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('All');

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

  const filteredLogs = useMemo(() => {
    const searchValue = searchTerm.toLowerCase().trim();

    return logs.filter((log) => {
      const ticketNumber = log.tickets?.ticket_number || '';

      const matchesSearch =
        !searchValue ||
        log.user_name?.toLowerCase().includes(searchValue) ||
        log.role?.toLowerCase().includes(searchValue) ||
        log.action?.toLowerCase().includes(searchValue) ||
        log.details?.toLowerCase().includes(searchValue) ||
        ticketNumber.toLowerCase().includes(searchValue);

      const matchesAction =
        actionFilter === 'All' || log.action === actionFilter;

      return matchesSearch && matchesAction;
    });
  }, [logs, searchTerm, actionFilter]);

  const getActionClass = (action) => {
    const normalized = action?.toLowerCase() || '';

    if (normalized.includes('resolved')) {
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    }

    if (normalized.includes('pending') || normalized.includes('investigation')) {
      return 'bg-orange-50 text-orange-700 ring-orange-100';
    }

    if (normalized.includes('created')) {
      return 'bg-[#eef9fd] text-[#2389b8] ring-[#43acd6]/15';
    }

    if (normalized.includes('assigned') || normalized.includes('reassigned')) {
      return 'bg-violet-50 text-violet-700 ring-violet-100';
    }

    return 'bg-slate-100 text-slate-600 ring-slate-200';
  };

  const getActionDotClass = (action) => {
    const normalized = action?.toLowerCase() || '';

    if (normalized.includes('resolved')) {
      return 'bg-emerald-500';
    }

    if (normalized.includes('pending') || normalized.includes('investigation')) {
      return 'bg-orange-500';
    }

    if (normalized.includes('created')) {
      return 'bg-[#43acd6]';
    }

    if (normalized.includes('assigned') || normalized.includes('reassigned')) {
      return 'bg-violet-500';
    }

    return 'bg-slate-400';
  };

  const formatTime = (value) => {
    if (!value) return 'N/A';

    return new Date(value).toLocaleString();
  };

  return (
    <DashboardLayout
      title="Audit Logs"
      description="Track important system and user actions across the Central Chat system."
    >
      <div className="w-full">
        <section className="overflow-hidden rounded-3xl border border-black/6 bg-white/90 shadow-[0_14px_40px_rgba(0,0,0,0.035)] backdrop-blur">
          <div className="flex flex-col justify-between gap-3 border-b border-black/6 px-5 py-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
                <ShieldCheck size={18} />
              </div>

              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">
                  System Activity
                </h2>

                <p className="mt-0.5 text-sm text-[#6e6e73]">
                  {filteredLogs.length} of {logs.length} audit logs shown.
                </p>
              </div>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#f5f5f7] px-3 py-1.5 text-xs font-medium text-[#6e6e73] ring-1 ring-black/6">
              <span className="h-2 w-2 rounded-full bg-[#43acd6]" />
              Live tracking
            </div>
          </div>

          <div className="border-b border-black/6 px-5 py-4">
            <div className="grid gap-3 md:grid-cols-[1fr_320px]">
              <div className="system-input flex h-11 items-center gap-3 rounded-2xl px-4">
                <Search size={16} className="shrink-0 text-[#8e8e93]" />

                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search user, role, action, ticket number, details..."
                  className="w-full bg-transparent text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
                />
              </div>

              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                className="system-input h-11 rounded-2xl px-4 text-sm text-[#1d1d1f] outline-none"
              >
                {actionFilters.map((action) => (
                  <option key={action}>{action}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-44 items-center justify-center p-8 text-sm text-[#6e6e73]">
              <div className="text-center">
                <Loader2
                  size={24}
                  className="mx-auto mb-3 animate-spin text-[#43acd6]"
                />
                Loading audit logs...
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-265 table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-45" />
                  <col className="w-42.5" />
                  <col className="w-37.5" />
                  <col className="w-65" />
                  <col className="w-37.5" />
                  <col className="w-90" />
                </colgroup>

                <thead className="bg-[#f5f5f7] text-[11px] uppercase tracking-[0.16em] text-[#8e8e93]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Time</th>
                    <th className="px-5 py-3 font-semibold">User</th>
                    <th className="px-5 py-3 font-semibold">Role</th>
                    <th className="px-5 py-3 font-semibold">Action</th>
                    <th className="px-5 py-3 font-semibold">Ticket</th>
                    <th className="px-5 py-3 font-semibold">Details</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-black/5">
                  {filteredLogs.map((log) => {
                    const ticketNumber = log.tickets?.ticket_number || 'N/A';
                    const time = formatTime(log.created_at);

                    return (
                      <tr key={log.id} className="transition hover:bg-[#f8fafc]">
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <div className="flex items-center gap-2 text-[#6e6e73]">
                            <Clock
                              size={14}
                              className="shrink-0 text-[#8e8e93]"
                            />

                            <span title={time} className="truncate">
                              {time}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <div
                            title={log.user_name || 'System'}
                            className="truncate font-medium text-[#1d1d1f]"
                          >
                            {log.user_name || 'System'}
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <span
                            title={log.role || 'System'}
                            className="inline-flex max-w-full rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-medium text-[#6e6e73] ring-1 ring-black/6"
                          >
                            <span className="truncate">
                              {log.role || 'System'}
                            </span>
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <span
                            title={log.action}
                            className={`inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${getActionClass(
                              log.action
                            )}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${getActionDotClass(
                                log.action
                              )}`}
                            />

                            <span className="truncate">
                              {log.action || 'Unknown Action'}
                            </span>
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-3.5">
                          <div
                            title={ticketNumber}
                            className="truncate text-[#6e6e73]"
                          >
                            {ticketNumber}
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <div
                            title={log.details || 'No details provided.'}
                            className="line-clamp-2 max-w-85 text-[#6e6e73]"
                          >
                            {log.details || 'No details provided.'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

const EmptyState = () => {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
        <ShieldCheck size={21} />
      </div>

      <h3 className="mt-4 font-semibold text-[#1d1d1f]">
        No audit logs found
      </h3>

      <p className="mt-2 text-sm text-[#6e6e73]">
        Try changing your search keyword or action filter.
      </p>
    </div>
  );
};

export default AuditLogsPage;