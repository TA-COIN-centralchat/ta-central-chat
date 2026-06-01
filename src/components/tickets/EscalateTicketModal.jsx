import { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

import { updateTicketStatus } from '../../services/ticketService';

const EscalateTicketModal = ({ open, onClose, ticket, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  if (!open) return null;

  const handleEscalate = async () => {
    if (!reason.trim()) {
      alert('Please enter a reason for escalation.');
      return;
    }

    try {
      setLoading(true);

      await updateTicketStatus({
        ticketId: ticket.dbId,
        status: 'Pending Investigation',
        auditDetails: `Ticket escalated to Pending Investigation. Reason: ${reason}`,
      });

      if (onUpdated) {
        onUpdated('Pending Investigation');
      }

      setReason('');
      onClose();
    } catch (error) {
      console.error('Escalate ticket error:', error);
      alert('Failed to escalate ticket.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/60 dark:border-white/10 bg-white dark:bg-[#1d1d1f] shadow-[0_24px_70px_rgba(15,23,42,0.22)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.4)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#edf1f5] dark:border-white/10 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-500 ring-1 ring-orange-100 dark:ring-orange-500/20">
              <AlertTriangle size={21} />
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#1d1d1f] dark:text-[#f5f5f7]">
                Escalate to Investigation
              </h2>

              <p className="mt-1 text-sm leading-6 text-[#6e6e73] dark:text-[#a1a1a6]">
                Use this when{' '}
                <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {ticket?.id}
                </span>{' '}
                cannot be solved immediately.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-[#8e8e93] dark:text-[#a1a1a6] transition hover:bg-[#f5f5f7] dark:hover:bg-white/10 hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close escalation modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-[22px] border border-orange-100 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 p-4 text-sm leading-6 text-orange-700 dark:text-orange-500">
            Customer conversation may end, but the ticket investigation will
            continue internally until the issue is reviewed.
          </div>

          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
              Escalation Reason <span className="text-orange-600 dark:text-orange-500">*</span>
            </label>

            <textarea
              className="mt-2 w-full resize-none rounded-[22px] border border-[#e8edf2] dark:border-white/10 bg-[#f8fafc] dark:bg-white/5 px-4 py-3 text-sm leading-6 text-[#1d1d1f] dark:text-[#f5f5f7] outline-none transition placeholder:text-[#8e8e93] dark:placeholder:text-[#a1a1a6] focus:border-[#43acd6] dark:focus:border-[#43acd6] focus:bg-white dark:focus:bg-white/10 focus:ring-4 focus:ring-[#43acd6]/10"
              rows="5"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this ticket needs internal investigation..."
            />

            <p className="mt-2 text-xs text-[#8e8e93] dark:text-[#a1a1a6]">
              This reason will be saved in the audit log.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse justify-end gap-3 border-t border-[#edf1f5] dark:border-white/10 bg-[#fbfbfd] dark:bg-[#151515] px-6 py-4 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-2xl border border-[#e5e7eb] dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm font-medium text-[#6e6e73] dark:text-[#a1a1a6] transition hover:bg-[#f5f5f7] dark:hover:bg-white/10 hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleEscalate}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(234,88,12,0.18)] dark:shadow-[0_14px_28px_rgba(234,88,12,0.3)] transition hover:bg-orange-700 dark:hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <AlertTriangle size={16} />
                Submit Investigation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EscalateTicketModal;