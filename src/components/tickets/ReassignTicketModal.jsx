import { useEffect, useState } from 'react';
import { ArrowRightLeft, Loader2, UserRound, X } from 'lucide-react';

import { getRawAgents, reassignTicket } from '../../services/ticketService';

const ReassignTicketModal = ({ open, onClose, ticket, onUpdated }) => {
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);

  useEffect(() => {
    if (!open) return;

    const loadAgents = async () => {
      try {
        setLoadingAgents(true);

        const data = await getRawAgents();

        // Reassignment targets follow the same rule as auto-assignment:
        // Admins never carry workload, so they're excluded from the picker.
        // Only Customer Service / Support Agents can take a reassigned ticket.
        const eligibleAgents = (data || []).filter((agent) => {
          const role = String(agent.role || '').trim();
          return (
            role === 'Customer Service Agent' ||
            role === 'Customer Support Agent'
          );
        });

        setAgents(eligibleAgents);
        setSelectedAgentId(eligibleAgents[0]?.id || '');
      } catch (error) {
        console.error('Failed to load agents:', error);
      } finally {
        setLoadingAgents(false);
      }
    };

    loadAgents();
  }, [open]);

  if (!open) return null;

  const handleReassign = async () => {
    if (!selectedAgentId) {
      alert('Please select an agent.');
      return;
    }

    try {
      setLoading(true);

      const result = await reassignTicket({
        ticketId: ticket.dbId,
        newAgentId: selectedAgentId,
        reason,
      });

      if (onUpdated) {
        onUpdated(result.newAgent.full_name);
      }

      setReason('');
      onClose();
    } catch (error) {
      console.error('Reassign ticket error:', error);
      alert('Failed to reassign ticket. Please check console.');
    } finally {
      setLoading(false);
    }
  };

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/60 dark:border-white/10 bg-white dark:bg-[#1d1d1f] shadow-[0_24px_70px_rgba(15,23,42,0.22)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.4)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#edf1f5] dark:border-white/10 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f7fbfd] dark:bg-[#43acd6]/10 text-[#2389b8] dark:text-[#43acd6] ring-1 ring-[#d8eef7] dark:ring-[#43acd6]/20">
              <ArrowRightLeft size={21} />
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#1d1d1f] dark:text-[#f5f5f7]">
                Reassign Ticket
              </h2>

              <p className="mt-1 text-sm leading-6 text-[#6e6e73] dark:text-[#a1a1a6]">
                Choose another agent to continue handling this ticket.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-[#8e8e93] dark:text-[#a1a1a6] transition hover:bg-[#f5f5f7] dark:hover:bg-white/10 hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close reassign modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-[22px] border border-[#e8edf2] dark:border-white/10 bg-[#f8fafc] dark:bg-white/5 p-4">
            <div
              title={ticket?.id}
              className="truncate text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
            >
              {ticket?.id}
            </div>

            <div className="mt-1 text-sm leading-6 text-[#6e6e73] dark:text-[#a1a1a6]">
              {ticket?.customer || 'Unknown customer'} · Current agent:{' '}
              <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                {ticket?.assignedTo || 'Unassigned'}
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
              New Agent <span className="text-[#2389b8] dark:text-[#43acd6]">*</span>
            </label>

            <select
              value={selectedAgentId}
              onChange={(event) => setSelectedAgentId(event.target.value)}
              disabled={loadingAgents || loading}
              className="system-select system-select--lg mt-2"
            >
              {loadingAgents ? (
                <option>Loading agents...</option>
              ) : agents.length === 0 ? (
                <option value="">No eligible agents available</option>
              ) : (
                agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.full_name} — {agent.role} — {agent.status}
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedAgent && (
            <div className="flex items-start gap-3 rounded-[22px] border border-[#d8eef7] dark:border-[#43acd6]/30 bg-[#f7fbfd] dark:bg-[#43acd6]/10 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-[#1d1d1f] text-[#2389b8] dark:text-[#43acd6] ring-1 ring-[#d8eef7] dark:ring-[#43acd6]/20">
                <UserRound size={18} />
              </div>

              <div className="min-w-0">
                <div
                  title={selectedAgent.full_name}
                  className="truncate text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
                >
                  {selectedAgent.full_name}
                </div>

                <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#6e6e73] dark:text-[#a1a1a6]">
                  <span>{selectedAgent.role}</span>
                  <span>·</span>
                  <span>{selectedAgent.status || 'Unknown status'}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
              Reason for Reassignment
            </label>

            <textarea
              rows="4"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Example: Agent is busy, wrong department, needs customer support investigation..."
              className="mt-2 w-full resize-none rounded-[22px] border border-[#e8edf2] dark:border-white/10 bg-[#f8fafc] dark:bg-white/5 px-4 py-3 text-sm leading-6 text-[#1d1d1f] dark:text-[#f5f5f7] outline-none transition placeholder:text-[#8e8e93] dark:placeholder:text-[#a1a1a6] focus:border-[#43acd6] dark:focus:border-[#43acd6] focus:bg-white dark:focus:bg-white/10 focus:ring-4 focus:ring-[#43acd6]/10"
            />

            <p className="mt-2 text-xs text-[#8e8e93] dark:text-[#a1a1a6]">
              This note helps the next agent understand why the ticket was
              reassigned.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-[#edf1f5] dark:border-white/10 bg-[#fbfbfd] dark:bg-[#151515] px-6 py-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-2xl border border-[#e5e7eb] dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm font-medium text-[#6e6e73] dark:text-[#a1a1a6] transition hover:bg-[#f5f5f7] dark:hover:bg-white/10 hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-60 sm:mr-auto"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleReassign}
            disabled={loading || loadingAgents}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#43acd6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] dark:shadow-[0_14px_28px_rgba(67,172,214,0.3)] transition hover:bg-[#2389b8] dark:hover:bg-[#52bce8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Reassigning...
              </>
            ) : (
              <>
                <ArrowRightLeft size={16} />
                Confirm Reassign
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReassignTicketModal;