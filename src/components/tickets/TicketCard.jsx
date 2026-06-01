const statusStyles = {
  New: 'bg-[#fffbea] text-[#8a6d00] ring-[#ffe88a]',
  Assigned: 'bg-[#f7fbfd] text-[#2389b8] ring-[#d8eef7]',
  'In Progress': 'bg-amber-50 text-amber-700 ring-amber-100',
  'Waiting for Customer': 'bg-[#f5f5f7] text-[#6e6e73] ring-[#e5e7eb]',
  'Pending Investigation': 'bg-orange-50 text-orange-700 ring-orange-100',
  'Ready to Contact Customer': 'bg-[#f7fbfd] text-[#2389b8] ring-[#d8eef7]',
  Resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  Closed: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const getStatusDot = (status) => {
  const normalized = status?.toLowerCase().trim();

  if (normalized === 'new') return 'bg-[#ffd84d]';
  if (normalized === 'assigned') return 'bg-[#43acd6]';
  if (normalized === 'in progress') return 'bg-amber-500';
  if (normalized === 'waiting for customer') return 'bg-[#8e8e93]';
  if (normalized === 'pending investigation') return 'bg-orange-500';
  if (
    normalized === 'ready to contact customer' ||
    normalized === 'ready to contact'
  ) {
    return 'bg-[#43acd6]';
  }
  if (normalized === 'resolved') return 'bg-emerald-500';
  if (normalized === 'closed') return 'bg-slate-400';

  return 'bg-[#8e8e93]';
};

const TicketCard = ({ ticket, active }) => {
  return (
    <button
      type="button"
      className={`w-full rounded-3xl border p-4 text-left transition ${
        active
          ? 'border-[#d8eef7] bg-[#f7fbfd] shadow-[0_14px_32px_rgba(67,172,214,0.12)]'
          : 'border-[#e8edf2] bg-white hover:border-[#d8eef7] hover:bg-[#fbfdff]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            title={ticket.id}
            className="truncate text-sm font-semibold text-[#1d1d1f]"
          >
            {ticket.id}
          </div>

          <div
            title={ticket.customer}
            className="mt-1 truncate text-sm font-medium text-[#6e6e73]"
          >
            {ticket.customer || 'Unknown customer'}
          </div>
        </div>

        <span
          title={ticket.time}
          className="shrink-0 text-xs text-[#8e8e93]"
        >
          {ticket.time || 'N/A'}
        </span>
      </div>

      <p
        title={ticket.lastMessage}
        className="mt-3 line-clamp-2 text-sm leading-6 text-[#6e6e73]"
      >
        {ticket.lastMessage || 'No recent message.'}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <span
          title={ticket.channel}
          className="inline-flex max-w-full rounded-full bg-[#f5f5f7] px-2.5 py-1 text-xs font-medium text-[#6e6e73] ring-1 ring-[#e5e7eb]"
        >
          <span className="truncate">{ticket.channel || 'Unknown'}</span>
        </span>

        <span
          title={ticket.status}
          className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
            statusStyles[ticket.status] || statusStyles.New
          }`}
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${getStatusDot(
              ticket.status
            )}`}
          />
          <span className="truncate">{ticket.status || 'New'}</span>
        </span>

        <span
          title={ticket.category}
          className="inline-flex max-w-full rounded-full bg-[#f7fbfd] px-2.5 py-1 text-xs font-medium text-[#2389b8] ring-1 ring-[#d8eef7]"
        >
          <span className="truncate">{ticket.category || 'No category'}</span>
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span
          title={ticket.assignedTo}
          className="truncate text-[#8e8e93]"
        >
          {ticket.assignedTo || 'Unassigned'}
        </span>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 font-medium ring-1 ${
            ticket.infoComplete
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
              : 'bg-red-50 text-red-700 ring-red-100'
          }`}
        >
          {ticket.infoComplete ? 'Info complete' : 'Info missing'}
        </span>
      </div>
    </button>
  );
};

export default TicketCard;