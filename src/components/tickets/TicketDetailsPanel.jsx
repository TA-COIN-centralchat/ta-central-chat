import { useEffect, useState } from 'react';
import { Lock, X } from 'lucide-react';
import ReassignTicketModal from './ReassignTicketModal';
import { supabase } from '../../services/supabaseClient';

const TicketDetailsPanel = ({ ticket, onTicketUpdated }) => {
  const [showReassign, setShowReassign] = useState(false);
  const [showAuditHistory, setShowAuditHistory] = useState(false);
  const [localAssignedTo, setLocalAssignedTo] = useState(ticket?.assignedTo);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalAssignedTo(ticket?.assignedTo);
  }, [ticket?.assignedTo]);

  if (!ticket) {
    return (
      <aside className="overflow-y-auto rounded-2xl border border-slate-200 bg-white">
        <div className="p-6 text-center text-sm text-slate-500">
          Select a ticket to view details.
        </div>
      </aside>
    );
  }

  const isTicketLocked =
    ticket.status === 'Resolved' || ticket.status === 'Closed';

  const handleReassignUpdated = async (newAgentName) => {
    setLocalAssignedTo(newAgentName);

    if (onTicketUpdated) {
      await onTicketUpdated();
    }
  };

  return (
    <>
      <aside className="overflow-y-auto rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h2 className="font-semibold text-slate-950">Ticket Details</h2>
          <p className="mt-1 text-sm text-slate-500">
            Customer information and ticket controls.
          </p>
        </div>

        <div className="space-y-5 p-4">
          {isTicketLocked && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <Lock size={16} />
                Ticket Locked
              </div>
              <p className="mt-1">
                This ticket is {ticket.status}. It is now read-only and cannot
                be reassigned from this panel.
              </p>
            </div>
          )}

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Customer Information
            </h3>

            {!ticket.infoComplete ? (
              <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                Customer information is incomplete.
              </div>
            ) : null}

            <div className="space-y-3 text-sm">
              <Detail label="Full Name" value={ticket.customer} />
              <Detail label="Phone" value={ticket.phone || 'Not provided'} />
              <Detail label="Telegram" value={ticket.telegram || 'Not provided'} />
              <Detail label="Email" value={ticket.email || 'Not provided'} />
              <Detail
                label="T.A Coin User ID"
                value={ticket.accountId || 'Not provided'}
              />
              <Detail label="Source Channel" value={ticket.channel} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Ticket Information
            </h3>

            <div className="space-y-3 text-sm">
              <Detail label="Ticket ID" value={ticket.id} />
              <Detail label="Issue Type" value={ticket.category} />
              <Detail
                label="Sub-category"
                value={ticket.subCategory || 'Not provided'}
              />
              <Detail label="Status" value={ticket.status} />
              <Detail
                label="Assigned To"
                value={localAssignedTo || ticket.assignedTo}
              />
              <Detail
                label="Transaction ID"
                value={ticket.transactionId || 'Not provided'}
              />
              <Detail label="Created" value={ticket.time || 'Not provided'} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Ticket Controls
            </h3>

            <div className="space-y-3">
              {isTicketLocked ? (
                <button
                  type="button"
                  disabled
                  className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500"
                >
                  <Lock size={16} />
                  Reassign Disabled
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowReassign(true)}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Reassign Ticket
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowAuditHistory(true)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                View Audit History
              </button>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Activity Timeline
            </h3>

            <div className="space-y-3 border-l border-slate-200 pl-4 text-sm">
              <TimelineItem
                title="Ticket created"
                time={ticket.time || 'Unknown'}
              />
              <TimelineItem
                title={`Assigned to ${localAssignedTo || ticket.assignedTo}`}
                time={ticket.time || 'Unknown'}
              />
              {isTicketLocked && (
                <TimelineItem
                  title={`Ticket marked as ${ticket.status}`}
                  time="Latest update"
                />
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Internal Notes
            </h3>

            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Internal notes added in the chat window are saved in Supabase.
              {isTicketLocked
                ? ' Since this ticket is closed/resolved, new notes cannot be added from the chat box.'
                : ''}
            </div>
          </section>
        </div>
      </aside>

      <ReassignTicketModal
        open={showReassign}
        onClose={() => setShowReassign(false)}
        ticket={ticket}
        onUpdated={handleReassignUpdated}
      />

      <AuditHistoryModal
        open={showAuditHistory}
        onClose={() => setShowAuditHistory(false)}
        ticket={ticket}
      />
    </>
  );
};

const AuditHistoryModal = ({ open, onClose, ticket }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !ticket?.dbId) return;

    const loadAuditLogs = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('ticket_id', ticket.dbId)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setLogs(data || []);
      } catch (error) {
        console.error('Failed to load ticket audit history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAuditLogs();
  }, [open, ticket?.dbId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Audit History
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Activity history for {ticket?.id}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {loading ? (
            <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
              Loading audit history...
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-6 text-center">
              <div className="font-semibold text-slate-900">
                No audit history found
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Actions for this ticket will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {log.action}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {log.user_name || 'System'} · {log.role || 'System'}
                      </div>
                    </div>

                    <div className="text-xs text-slate-400">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {log.details || 'No details provided.'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const Detail = ({ label, value }) => (
  <div>
    <div className="text-xs text-slate-400">{label}</div>
    <div className="font-medium text-slate-800">{value}</div>
  </div>
);

const TimelineItem = ({ title, time }) => (
  <div>
    <div className="font-medium text-slate-800">{title}</div>
    <div className="text-xs text-slate-400">{time}</div>
  </div>
);

export default TicketDetailsPanel;