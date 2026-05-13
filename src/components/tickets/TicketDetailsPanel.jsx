import { useState } from 'react';
import ReassignTicketModal from './ReassignTicketModal';

const TicketDetailsPanel = ({ ticket, onTicketUpdated }) => {
  const [showReassign, setShowReassign] = useState(false);
  const [localAssignedTo, setLocalAssignedTo] = useState(ticket?.assignedTo);

  if (!ticket) {
    return (
      <aside className="overflow-y-auto rounded-2xl border border-slate-200 bg-white">
        <div className="p-6 text-center text-sm text-slate-500">
          Select a ticket to view details.
        </div>
      </aside>
    );
  }

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
              <Detail label="Sub-category" value={ticket.subCategory || 'Not provided'} />
              <Detail label="Status" value={ticket.status} />
              <Detail label="Assigned To" value={localAssignedTo || ticket.assignedTo} />
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
              <button
                type="button"
                onClick={() => setShowReassign(true)}
                className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Reassign Ticket
              </button>

              <button
                type="button"
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
              <TimelineItem title="Ticket created" time={ticket.time || 'Unknown'} />
              <TimelineItem
                title={`Assigned to ${localAssignedTo || ticket.assignedTo}`}
                time={ticket.time || 'Unknown'}
              />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Internal Notes
            </h3>

            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Internal notes added in the chat window will be saved in Supabase.
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
    </>
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