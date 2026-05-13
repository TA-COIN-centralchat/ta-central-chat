const TicketDetailsPanel = ({ ticket }) => {
  return (
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
            <Detail label="T.A Coin User ID" value={ticket.accountId || 'Not provided'} />
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
            <Detail label="Sub-category" value={ticket.subCategory} />
            <Detail label="Status" value={ticket.status} />
            <Detail label="Assigned To" value={ticket.assignedTo} />
            <Detail label="Transaction ID" value={ticket.transactionId || 'Not provided'} />
            <Detail label="Created" value="04 May 2026, 10:30 AM" />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Ticket Controls
          </h3>

          <div className="space-y-3">
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
              <option>{ticket.status}</option>
              <option>New</option>
              <option>Assigned</option>
              <option>In Progress</option>
              <option>Waiting for Customer</option>
              <option>Pending Investigation</option>
              <option>Resolved</option>
              <option>Closed</option>
            </select>

            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
              <option>{ticket.assignedTo}</option>
              <option>Agent Dara</option>
              <option>Agent Lina</option>
              <option>Customer Support</option>
            </select>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Activity Timeline
          </h3>

          <div className="space-y-3 border-l border-slate-200 pl-4 text-sm">
            <TimelineItem title="Ticket created" time="10:31 AM" />
            <TimelineItem title="Customer information submitted" time="10:31 AM" />
            <TimelineItem title="Assigned to Agent Dara" time="10:31 AM" />
            <TimelineItem title="Agent replied" time="10:32 AM" />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Internal Notes
          </h3>

          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            Customer provided transaction ID. Need to verify internally before closing.
          </div>
        </section>
      </div>
    </aside>
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