const statusStyles = {
  New: 'bg-[#fffbea] dark:bg-yellow-500/10 text-[#8a6d00] dark:text-yellow-500 ring-[#ffe88a] dark:ring-yellow-500/20',
  Assigned: 'bg-[#f7fbfd] dark:bg-[#43acd6]/10 text-[#2389b8] dark:text-[#43acd6] ring-[#d8eef7] dark:ring-[#43acd6]/20',
  'In Progress': 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-500 ring-amber-100 dark:ring-amber-500/20',
  'Waiting for Customer': 'bg-[#f5f5f7] dark:bg-white/5 text-[#6e6e73] dark:text-[#a1a1a6] ring-[#e5e7eb] dark:ring-white/10',
  'Pending Investigation': 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-500 ring-orange-100 dark:ring-orange-500/20',
  'Ready to Contact Customer': 'bg-[#f7fbfd] dark:bg-[#43acd6]/10 text-[#2389b8] dark:text-[#43acd6] ring-[#d8eef7] dark:ring-[#43acd6]/20',
  Resolved: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 ring-emerald-100 dark:ring-emerald-500/20',
  Closed: 'bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400 ring-slate-200 dark:ring-slate-500/20',
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
          ? 'border-[#d8eef7] dark:border-[#43acd6]/30 bg-[#f7fbfd] dark:bg-[#43acd6]/5 shadow-[0_14px_32px_rgba(67,172,214,0.12)] dark:shadow-[0_14px_32px_rgba(67,172,214,0.2)]'
          : 'border-[#e8edf2] dark:border-white/10 bg-white dark:bg-white/5 hover:border-[#d8eef7] dark:hover:border-white/20 hover:bg-[#fbfdff] dark:hover:bg-white/10'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            title={ticket.id}
            className="truncate text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
          >
            {ticket.id}
          </div>

          <div
            title={ticket.customer}
            className="mt-1 truncate text-sm font-medium text-[#6e6e73] dark:text-[#a1a1a6]"
          >
            {ticket.customer || 'Unknown customer'}
          </div>
        </div>

        <span
          title={ticket.time}
          className="shrink-0 text-xs text-[#8e8e93] dark:text-[#a1a1a6]"
        >
          {ticket.time || 'N/A'}
        </span>
      </div>

      <p
        title={ticket.lastMessage}
        className="mt-3 line-clamp-2 text-sm leading-6 text-[#6e6e73] dark:text-[#a1a1a6]"
      >
        {ticket.lastMessage || 'No recent message.'}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <span
          title={ticket.channel}
          className="inline-flex max-w-full rounded-full bg-[#f5f5f7] dark:bg-white/5 px-2.5 py-1 text-xs font-medium text-[#6e6e73] dark:text-[#a1a1a6] ring-1 ring-[#e5e7eb] dark:ring-white/10"
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
          className="inline-flex max-w-full rounded-full bg-[#f7fbfd] dark:bg-[#43acd6]/10 px-2.5 py-1 text-xs font-medium text-[#2389b8] dark:text-[#43acd6] ring-1 ring-[#d8eef7] dark:ring-[#43acd6]/20"
        >
          <span className="truncate">{ticket.category || 'No category'}</span>
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span
          title={ticket.assignedTo}
          className="truncate text-[#8e8e93] dark:text-[#a1a1a6]"
        >
          {ticket.assignedTo || 'Unassigned'}
        </span>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 font-medium ring-1 ${
            ticket.infoComplete
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 ring-emerald-100 dark:ring-emerald-500/20'
              : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-500 ring-red-100 dark:ring-red-500/20'
          }`}
        >
          {ticket.infoComplete ? 'Info complete' : 'Info missing'}
        </span>
      </div>
    </button>
  );
};

export default TicketCard;