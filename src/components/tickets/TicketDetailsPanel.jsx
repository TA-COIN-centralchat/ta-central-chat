import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  FileText,
  History,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Tag,
  UserRound,
  X,
} from 'lucide-react';

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
      <aside className="flex h-full items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f7fbfd] text-[#2389b8] ring-1 ring-[#d8eef7]">
            <FileText size={22} />
          </div>

          <p className="mt-4 text-sm text-[#6e6e73]">
            Select a ticket to view details.
          </p>
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
      <aside className="flex h-full flex-col bg-white">
        <div className="border-b border-[#edf1f5] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f7fbfd] text-[#2389b8] ring-1 ring-[#d8eef7]">
              <FileText size={18} />
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[#1d1d1f]">
                Ticket Details
              </h2>

              <p className="mt-1 text-sm leading-5 text-[#6e6e73]">
                Customer information and ticket controls.
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#fbfbfd] p-4">
          {isTicketLocked && (
            <div className="rounded-[22px] border border-[#e5e7eb] bg-[#f8fafc] p-4 text-sm text-[#6e6e73]">
              <div className="flex items-center gap-2 font-semibold text-[#1d1d1f]">
                <Lock size={16} />
                Ticket Locked
              </div>

              <p className="mt-1 leading-6">
                This ticket is {ticket.status}. It is now read-only and cannot
                be reassigned from this panel.
              </p>
            </div>
          )}

          {!ticket.infoComplete && (
            <div className="rounded-[22px] border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />

                <p>Customer information is incomplete.</p>
              </div>
            </div>
          )}

          <SideCard
            icon={UserRound}
            title="Customer Information"
            description="Contact details collected for this ticket."
          >
            <div className="space-y-4">
              <Detail label="Full Name" value={ticket.customer} />
              <Detail
                icon={Phone}
                label="Phone"
                value={ticket.phone || 'Not provided'}
              />
              <Detail
                label="Telegram"
                value={ticket.telegram || 'Not provided'}
              />
              <Detail
                icon={Mail}
                label="Email"
                value={ticket.email || 'Not provided'}
              />
              <Detail
                label="T.A Coin User ID"
                value={ticket.accountId || 'Not provided'}
              />
              <Detail label="Source Channel" value={ticket.channel} />
            </div>
          </SideCard>

          <SideCard
            icon={Tag}
            title="Ticket Information"
            description="Issue classification and ownership."
          >
            <div className="space-y-4">
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
          </SideCard>

          <SideCard
            icon={ShieldCheck}
            title="Ticket Controls"
            description="Operational actions for this ticket."
          >
            <div className="space-y-3">
              {isTicketLocked ? (
                <button
                  type="button"
                  disabled
                  className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-[#f5f5f7] px-4 py-2.5 text-sm font-medium text-[#8e8e93] ring-1 ring-[#e5e7eb]"
                >
                  <Lock size={16} />
                  Reassign Disabled
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowReassign(true)}
                  className="w-full rounded-2xl bg-[#43acd6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:bg-[#2389b8]"
                >
                  Reassign Ticket
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowAuditHistory(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6e6e73] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
              >
                <History size={16} />
                View Audit History
              </button>
            </div>
          </SideCard>

          <SideCard
            icon={Activity}
            title="Activity Timeline"
            description="Recent key events for this ticket."
          >
            <div className="space-y-4 border-l border-[#d8eef7] pl-4 text-sm">
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
          </SideCard>

          <SideCard title="Internal Notes">
            <div className="rounded-[22px] border border-[#ffe88a] bg-[#fffbea] p-4 text-sm leading-6 text-[#7a5d00]">
              Internal notes added in the chat window are saved in Supabase.
              {isTicketLocked
                ? ' Since this ticket is closed/resolved, new notes cannot be added from the chat box.'
                : ''}
            </div>
          </SideCard>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#edf1f5] px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f7fbfd] text-[#2389b8] ring-1 ring-[#d8eef7]">
              <History size={21} />
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#1d1d1f]">
                Audit History
              </h2>

              <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
                Activity history for{' '}
                <span className="font-medium text-[#1d1d1f]">
                  {ticket?.id}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-[#8e8e93] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
            aria-label="Close audit history"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfbfd] p-5">
          {loading ? (
            <div className="rounded-[22px] border border-[#e8edf2] bg-white p-6 text-center text-sm text-[#6e6e73]">
              Loading audit history...
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-[22px] border border-[#e8edf2] bg-white p-6 text-center">
              <div className="font-semibold text-[#1d1d1f]">
                No audit history found
              </div>

              <p className="mt-1 text-sm text-[#6e6e73]">
                Actions for this ticket will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-[22px] border border-[#e8edf2] bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[#1d1d1f]">
                        {log.action}
                      </div>

                      <div className="mt-1 text-sm text-[#6e6e73]">
                        {log.user_name || 'System'} · {log.role || 'System'}
                      </div>
                    </div>

                    <div className="text-xs text-[#8e8e93]">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-[#6e6e73]">
                    {log.details || 'No details provided.'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[#edf1f5] bg-white p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-[#43acd6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:bg-[#2389b8]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const SideCard = ({ icon: Icon, title, description, children }) => {
  return (
    <section className="rounded-3xl border border-[#e8edf2] dark:border-white/10 bg-white dark:bg-[#1d1d1f] shadow-sm">
      <div className="border-b border-[#edf1f5] dark:border-white/10 p-4">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#f7fbfd] dark:bg-[#43acd6]/10 text-[#2389b8] dark:text-[#43acd6] ring-1 ring-[#d8eef7] dark:ring-[#43acd6]/20">
              <Icon size={16} />
            </div>
          )}

          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{title}</h3>

            {description && (
              <p className="mt-1 text-xs leading-5 text-[#6e6e73] dark:text-[#a1a1a6]">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4">{children}</div>
    </section>
  );
};

const Detail = ({ icon: Icon, label, value }) => (
  <div className="min-w-0">
    <div className="flex items-center gap-1.5 text-xs text-[#8e8e93] dark:text-[#a1a1a6]">
      {Icon && <Icon size={12} />}
      {label}
    </div>

    <div
      title={value}
      className="wrap-break-word mt-1 font-medium text-[#1d1d1f] dark:text-[#f5f5f7]"
    >
      {value}
    </div>
  </div>
);

const TimelineItem = ({ title, time }) => (
  <div className="relative">
    <span className="absolute -left-5.25 top-1.5 h-2.5 w-2.5 rounded-full bg-[#43acd6] ring-4 ring-[#f7fbfd] dark:ring-[#1d1d1f]" />

    <div className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">{title}</div>
    <div className="mt-1 text-xs text-[#8e8e93] dark:text-[#a1a1a6]">{time}</div>
  </div>
);

export default TicketDetailsPanel;