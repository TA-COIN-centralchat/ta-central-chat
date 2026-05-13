const statusStyles = {
  New: 'bg-slate-100 text-slate-700',
  Assigned: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  'Waiting for Customer': 'bg-purple-100 text-purple-700',
  'Pending Investigation': 'bg-orange-100 text-orange-700',
  Resolved: 'bg-emerald-100 text-emerald-700',
  Closed: 'bg-slate-200 text-slate-600',
};

const TicketCard = ({ ticket, active }) => {
  return (
    <button
      className={`w-full rounded-2xl border p-4 text-left transition ${
        active
          ? 'border-blue-500 bg-blue-50 shadow-sm'
          : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-900">{ticket.id}</div>
          <div className="mt-1 text-sm text-slate-700">{ticket.customer}</div>
        </div>

        <span className="text-xs text-slate-400">{ticket.time}</span>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-slate-600">
        {ticket.lastMessage}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
          {ticket.channel}
        </span>

        <span
          className={`rounded-full px-2.5 py-1 text-xs ${
            statusStyles[ticket.status] || statusStyles.New
          }`}
        >
          {ticket.status}
        </span>

        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
          {ticket.category}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{ticket.assignedTo}</span>

        <span
          className={
            ticket.infoComplete ? 'text-emerald-600' : 'text-red-500'
          }
        >
          {ticket.infoComplete ? 'Info complete' : 'Info missing'}
        </span>
      </div>
    </button>
  );
};

export default TicketCard;