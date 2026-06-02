import { useState } from 'react';
import { CheckCircle, Loader2, X } from 'lucide-react';

import { updateTicketStatus } from '../../services/ticketService';

const ResolveTicketModal = ({ open, onClose, ticket, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');

  if (!open) return null;

  const handleResolve = async () => {
    if (!resolutionNote.trim()) {
      alert('Please enter a resolution note.');
      return;
    }

    try {
      setLoading(true);

      await updateTicketStatus({
        ticketId: ticket.dbId,
        status: 'Resolved',
        auditDetails: `Ticket resolved. Resolution note: ${resolutionNote}`,
      });

      if (onUpdated) {
        onUpdated('Resolved');
      }

      setResolutionNote('');
      onClose();
    } catch (error) {
      console.error('Resolve ticket error:', error);
      alert('Failed to resolve ticket.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/60 dark:border-white/10 bg-white dark:bg-[#1d1d1f] shadow-[0_24px_70px_rgba(15,23,42,0.22)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.4)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#edf1f5] dark:border-white/10 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 ring-1 ring-emerald-100 dark:ring-emerald-500/20">
              <CheckCircle size={21} />
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#1d1d1f] dark:text-[#f5f5f7]">
                Resolve Ticket
              </h2>

              <p className="mt-1 text-sm leading-6 text-[#6e6e73] dark:text-[#a1a1a6]">
                Add resolution details for{' '}
                <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {ticket?.id}
                </span>
                .
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-[#8e8e93] dark:text-[#a1a1a6] transition hover:bg-[#f5f5f7] dark:hover:bg-white/10 hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close resolve modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-[22px] border border-[#e8edf2] dark:border-white/10 bg-[#f8fafc] dark:bg-white/5 p-4">
            <div
              title={ticket?.customer}
              className="truncate text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
            >
              {ticket?.customer || 'Unknown customer'}
            </div>

            <div
              title={ticket?.category}
              className="mt-1 truncate text-sm leading-6 text-[#6e6e73] dark:text-[#a1a1a6]"
            >
              {ticket?.category || 'No issue category'}
            </div>
          </div>

          <div className="rounded-[22px] border border-emerald-100 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-700 dark:text-emerald-500">
            Once resolved, this ticket will be locked from new replies and kept
            as part of the customer support history.
          </div>

          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
              Resolution Note <span className="text-emerald-600 dark:text-emerald-500">*</span>
            </label>

            <textarea
              className="mt-2 w-full resize-none rounded-[22px] border border-[#e8edf2] dark:border-white/10 bg-[#f8fafc] dark:bg-white/5 px-4 py-3 text-sm leading-6 text-[#1d1d1f] dark:text-[#f5f5f7] outline-none transition placeholder:text-[#8e8e93] dark:placeholder:text-[#a1a1a6] focus:border-[#43acd6] dark:focus:border-[#43acd6] focus:bg-white dark:focus:bg-white/10 focus:ring-4 focus:ring-[#43acd6]/10"
              rows="5"
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Explain how the issue was resolved..."
            />

            <p className="mt-2 text-xs text-[#8e8e93] dark:text-[#a1a1a6]">
              This note will be saved in the audit log.
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
            onClick={handleResolve}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(5,150,105,0.18)] dark:shadow-[0_14px_28px_rgba(5,150,105,0.3)] transition hover:bg-emerald-700 dark:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Resolving...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Resolve Ticket
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResolveTicketModal;