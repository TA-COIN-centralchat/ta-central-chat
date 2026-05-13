import { useEffect, useState } from 'react';
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
        setAgents(data);
        setSelectedAgentId(data[0]?.id || '');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-950">
          Reassign Ticket
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Choose another agent to handle this ticket.
        </p>

        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          <div className="font-medium text-slate-900">{ticket?.id}</div>
          <div>
            {ticket?.customer} · Current agent: {ticket?.assignedTo}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700">
            New Agent
          </label>

          <select
            value={selectedAgentId}
            onChange={(event) => setSelectedAgentId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            {loadingAgents ? (
              <option>Loading agents...</option>
            ) : (
              agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.full_name} — {agent.role} — {agent.status}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700">
            Reason for Reassignment
          </label>

          <textarea
            rows="4"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Example: Agent is busy, wrong department, needs customer support investigation..."
            className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            onClick={handleReassign}
            disabled={loading || loadingAgents}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Reassigning...' : 'Confirm Reassign'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReassignTicketModal;