import { useState } from "react";
import { updateTicketStatus } from "../../services/ticketService";

const ResolveTicketModal = ({ open, onClose, ticket, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");

  if (!open) return null;

  const handleResolve = async () => {
    if (!resolutionNote.trim()) {
      alert("Please enter a resolution note.");
      return;
    }

    try {
      setLoading(true);

      await updateTicketStatus({
        ticketId: ticket.dbId,
        status: "Resolved",
        auditDetails: `Ticket resolved. Resolution note: ${resolutionNote}`,
      });

      if (onUpdated) {
        onUpdated("Resolved");
      }

      setResolutionNote("");
      onClose();
    } catch (error) {
      console.error("Resolve ticket error:", error);
      alert("Failed to resolve ticket.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-950">Resolve Ticket</h2>

        <p className="mt-2 text-sm text-slate-500">
          Add resolution details for {ticket?.id}.
        </p>

        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          <div className="font-medium text-slate-900">{ticket?.customer}</div>
          <div>{ticket?.category}</div>
        </div>

        <textarea
          className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500"
          rows="5"
          value={resolutionNote}
          onChange={(e) => setResolutionNote(e.target.value)}
          placeholder="Resolution note..."
        />

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 h-10 px-4 text-sm"
          >
            Cancel
          </button>

          <button
            onClick={handleResolve}
            disabled={loading}
            className="rounded-xl bg-emerald-600 h-10 px-4 text-sm text-white disabled:opacity-60"
          >
            {loading ? "Resolving..." : "Resolve Ticket"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResolveTicketModal;
