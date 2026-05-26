import { useState } from "react";
import { updateTicketStatus } from "../../services/ticketService";

const EscalateTicketModal = ({ open, onClose, ticket, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  if (!open) return null;

  const handleEscalate = async () => {
    if (!reason.trim()) {
      alert("Please enter a reason for escalation.");
      return;
    }

    try {
      setLoading(true);

      await updateTicketStatus({
        ticketId: ticket.dbId,
        status: "Pending Investigation",
        auditDetails: `Ticket escalated to Pending Investigation. Reason: ${reason}`,
      });

      if (onUpdated) {
        onUpdated("Pending Investigation");
      }

      setReason("");
      onClose();
    } catch (error) {
      console.error("Escalate ticket error:", error);
      alert("Failed to escalate ticket.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-950">
          Escalate to Pending Investigation
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Use this when {ticket?.id} cannot be solved immediately.
        </p>

        <div className="mt-4 rounded-xl bg-orange-50 p-4 text-sm text-orange-800">
          Customer session may end, but the ticket investigation will continue
          internally.
        </div>

        <textarea
          className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500"
          rows="5"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for escalation..."
        />

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 h-10 px-4 text-sm"
          >
            Cancel
          </button>

          <button
            onClick={handleEscalate}
            disabled={loading}
            className="rounded-xl bg-orange-600 h-10 px-4 text-sm text-white disabled:opacity-60"
          >
            {loading ? "Submitting..." : "Submit Investigation"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EscalateTicketModal;
