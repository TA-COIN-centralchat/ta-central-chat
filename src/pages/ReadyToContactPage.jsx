import { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle,
  ChevronRight,
  Eye,
  Loader2,
  Search,
  Send,
  User,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import DashboardLayout from '../components/layout/DashboardLayout';
import { getTickets } from '../services/ticketService';

const ReadyToContactPage = () => {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  useEffect(() => {
    const loadReadyTickets = async () => {
      try {
        setLoading(true);

        const data = await getTickets();

        const filteredTickets = data.filter(
          (ticket) => ticket.status === 'Ready to Contact Customer'
        );

        setTickets(filteredTickets);

        if (filteredTickets.length > 0) {
          setSelectedTicketId(filteredTickets[0].dbId);
        }
      } catch (error) {
        console.error('Failed to load ready-to-contact tickets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReadyTickets();
  }, []);

  const filteredTickets = useMemo(() => {
    const searchValue = searchTerm.toLowerCase().trim();

    if (!searchValue) return tickets;

    return tickets.filter((ticket) => {
      return (
        ticket.id?.toLowerCase().includes(searchValue) ||
        ticket.customer?.toLowerCase().includes(searchValue) ||
        ticket.channel?.toLowerCase().includes(searchValue) ||
        ticket.category?.toLowerCase().includes(searchValue) ||
        ticket.subCategory?.toLowerCase().includes(searchValue) ||
        ticket.status?.toLowerCase().includes(searchValue) ||
        ticket.assignedTo?.toLowerCase().includes(searchValue) ||
        ticket.phone?.toLowerCase().includes(searchValue) ||
        ticket.telegram?.toLowerCase().includes(searchValue) ||
        ticket.email?.toLowerCase().includes(searchValue) ||
        ticket.accountId?.toLowerCase().includes(searchValue) ||
        ticket.transactionId?.toLowerCase().includes(searchValue)
      );
    });
  }, [tickets, searchTerm]);

  const selectedTicket = useMemo(() => {
    return (
      filteredTickets.find((ticket) => ticket.dbId === selectedTicketId) ||
      filteredTickets[0] ||
      null
    );
  }, [filteredTickets, selectedTicketId]);

  const openTicket = (ticket) => {
    navigate(`/tickets/${ticket.dbId}`, {
      state: {
        from: '/ready-to-contact',
        fromLabel: 'Ready to Contact',
      },
    });
  };

  const highPriorityCount = tickets.filter((ticket) => {
    const text = `${ticket.category || ''} ${ticket.subCategory || ''} ${
      ticket.lastMessage || ''
    }`.toLowerCase();

    return (
      text.includes('urgent') ||
      text.includes('high') ||
      text.includes('withdrawal') ||
      text.includes('payment')
    );
  }).length;

  const telegramCount = tickets.filter(
    (ticket) => ticket.channel?.toLowerCase() === 'telegram'
  ).length;

  return (
    <DashboardLayout
      title="Ready to Contact"
      description="Tickets where internal investigation is complete and the customer needs to be contacted."
    >
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[28px] border border-black/6 bg-white/90 shadow-[0_14px_40px_rgba(0,0,0,0.035)] backdrop-blur">
          <div className="flex flex-col justify-between gap-4 border-b border-black/6 px-5 py-4 xl:flex-row xl:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8] ring-1 ring-[#43acd6]/15">
                <Send size={19} />
              </div>

              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">
                  Customer Follow-up Queue
                </h2>

                <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
                  {filteredTickets.length} of {tickets.length} ready-to-contact
                  tickets shown.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusPill label="Ready" value={tickets.length} tone="blue" />
              <StatusPill
                label="High Priority"
                value={highPriorityCount}
                tone="orange"
              />
              <StatusPill
                label="Telegram"
                value={telegramCount}
                tone="slate"
              />
            </div>
          </div>

          <div className="border-b border-black/6 px-5 py-4">
            <div className="system-input flex h-11 max-w-2xl items-center gap-3 rounded-2xl px-4">
              <Search size={16} className="shrink-0 text-[#8e8e93]" />

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search ticket ID, customer, channel, or transaction..."
                className="w-full bg-transparent text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center p-8 text-sm text-[#6e6e73]">
              <div className="text-center">
                <Loader2
                  size={24}
                  className="mx-auto mb-3 animate-spin text-[#43acd6]"
                />
                Loading ready-to-contact tickets...
              </div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid min-h-130 xl:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.35fr)]">
              <div className="border-b border-black/6 xl:border-b-0 xl:border-r">
                <div className="max-h-155 overflow-y-auto">
                  {filteredTickets.map((ticket) => (
                    <TicketListItem
                      key={ticket.dbId}
                      ticket={ticket}
                      active={selectedTicket?.dbId === ticket.dbId}
                      onSelect={() => setSelectedTicketId(ticket.dbId)}
                      onOpen={() => openTicket(ticket)}
                    />
                  ))}
                </div>
              </div>

              <div className="min-w-0 bg-[#fbfbfd] p-5">
                {selectedTicket ? (
                  <TicketPreview
                    ticket={selectedTicket}
                    onOpen={() => openTicket(selectedTicket)}
                  />
                ) : (
                  <EmptyState />
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

const TicketListItem = ({ ticket, active, onSelect, onOpen }) => {
  const contact =
    ticket.phone || ticket.telegram || ticket.email || 'No contact provided';

  const preview = ticket.subCategory || ticket.lastMessage || 'No summary';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full border-b border-black/5 px-5 py-4 text-left transition last:border-b-0 ${
        active ? 'bg-[#eef9fd]' : 'bg-white hover:bg-[#f8fafc]'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef9fd] text-sm font-semibold text-[#2389b8] ring-1 ring-[#43acd6]/15">
          {getInitials(ticket.customer)}
        </div>

        <div className="min-w-0 flex-1">
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

              <div
                title={preview}
                className="mt-1 line-clamp-1 text-xs text-[#8e8e93]"
              >
                {preview}
              </div>
            </div>

            <ChevronRight
              size={16}
              className={`mt-1 shrink-0 ${
                active ? 'text-[#2389b8]' : 'text-[#8e8e93]'
              }`}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SourceBadge value={ticket.channel || 'Unknown'} />

            <span
              title={contact}
              className="max-w-45 truncate text-xs text-[#8e8e93]"
            >
              {contact}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-[#8e8e93]">
          Updated {ticket.time || 'N/A'}
        </span>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#2389b8] ring-1 ring-[#43acd6]/20 transition hover:bg-[#dff3fb]"
        >
          Open
        </button>
      </div>
    </button>
  );
};

const TicketPreview = ({ ticket, onOpen }) => {
  const contact =
    ticket.phone || ticket.telegram || ticket.email || 'No contact provided';

  const issuePreview = ticket.subCategory || ticket.lastMessage || 'No summary';

  return (
    <article className="h-full rounded-[26px] border border-black/6 bg-white shadow-[0_12px_36px_rgba(0,0,0,0.035)]">
      <div className="flex flex-col justify-between gap-4 border-b border-black/6 p-5 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              title={ticket.id}
              className="truncate text-lg font-semibold text-[#1d1d1f]"
            >
              {ticket.id}
            </h3>

            <StatusBadge value={ticket.status} />
          </div>

          <p className="mt-1 text-sm text-[#6e6e73]">
            Created / Updated: {ticket.time || 'N/A'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="inline-flex w-fit items-center gap-2 rounded-2xl bg-[#43acd6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:bg-[#2389b8]"
        >
          <Eye size={16} />
          Open Ticket
        </button>
      </div>

      <div className="grid gap-0 divide-y divide-black/6 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <PreviewSection
          icon={User}
          title="Customer Information"
          rows={[
            ['Name', ticket.customer || 'Unknown customer'],
            ['Contact', contact],
            ['Channel', ticket.channel || 'Unknown'],
            ['T.A Coin ID', ticket.accountId || 'N/A'],
          ]}
        />

        <PreviewSection
          icon={BellRing}
          title="Issue Summary"
          rows={[
            ['Issue Type', ticket.category || 'N/A'],
            ['Sub Issue', ticket.subCategory || 'N/A'],
            ['Transaction ID', ticket.transactionId || 'N/A'],
            ['Assigned To', ticket.assignedTo || 'Unassigned'],
          ]}
        />

        <div className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eef9fd] text-[#2389b8]">
              <CheckCircle size={16} />
            </div>

            <h4 className="text-sm font-semibold text-[#1d1d1f]">
              Follow-up Notes
            </h4>
          </div>

          <p
            title={issuePreview}
            className="line-clamp-6 text-sm leading-6 text-[#6e6e73]"
          >
            {issuePreview}
          </p>
        </div>
      </div>

      <div className="grid gap-0 divide-y divide-black/6 border-t border-black/6 lg:grid-cols-[1fr_1fr] lg:divide-x lg:divide-y-0">
        <div className="p-5">
          <h4 className="text-sm font-semibold text-[#1d1d1f]">Timeline</h4>

          <div className="mt-4 space-y-4">
            <TimelineItem
              title="Investigation completed"
              description="Ticket marked as Ready to Contact Customer."
              time={ticket.time || 'N/A'}
            />

            <TimelineItem
              title="Assigned for follow-up"
              description={`Assigned to ${ticket.assignedTo || 'Unassigned'}.`}
              time={ticket.time || 'N/A'}
            />
          </div>
        </div>

        <div className="p-5">
          <h4 className="text-sm font-semibold text-[#1d1d1f]">
            Quick Actions
          </h4>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#43acd6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:bg-[#2389b8]"
            >
              <Eye size={16} />
              Open Ticket
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-black/[0.07] bg-[#f5f5f7] px-4 py-2.5 text-sm font-medium text-[#6e6e73] transition hover:bg-white hover:text-[#1d1d1f]"
            >
              <Send size={16} />
              Send Follow-up
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
            >
              <CheckCircle size={16} />
              Mark Contacted
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

const PreviewSection = ({ icon: Icon, title, rows }) => {
  return (
    <div className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eef9fd] text-[#2389b8]">
          <Icon size={16} />
        </div>

        <h4 className="text-sm font-semibold text-[#1d1d1f]">{title}</h4>
      </div>

      <div className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[90px_1fr] gap-3 text-sm">
            <span className="text-[#8e8e93]">{label}</span>
            <span title={value} className="truncate font-medium text-[#6e6e73]">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatusPill = ({ label, value, tone }) => {
  const tones = {
    blue: 'bg-[#eef9fd] text-[#2389b8] ring-[#43acd6]/15',
    orange: 'bg-orange-50 text-orange-700 ring-orange-100',
    slate: 'bg-[#f5f5f7] text-[#6e6e73] ring-black/[0.06]',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${tones[tone]}`}
    >
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
};

const SourceBadge = ({ value }) => {
  return (
    <span
      title={value}
      className="inline-flex max-w-32.5 rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-medium text-[#6e6e73] ring-1 ring-black/6"
    >
      <span className="truncate">{value}</span>
    </span>
  );
};

const StatusBadge = ({ value }) => {
  return (
    <span
      title={value}
      className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#eef9fd] px-3 py-1 text-xs font-medium text-[#2389b8] ring-1 ring-[#43acd6]/15"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#43acd6]" />
      <span className="truncate">{value || 'Ready to Contact'}</span>
    </span>
  );
};

const TimelineItem = ({ title, description, time }) => {
  return (
    <div className="relative pl-5">
      <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[#43acd6]" />

      <div className="text-sm font-medium text-[#1d1d1f]">{title}</div>

      <p className="mt-1 text-sm leading-5 text-[#6e6e73]">{description}</p>

      <div className="mt-1 text-xs text-[#8e8e93]">{time}</div>
    </div>
  );
};

const EmptyState = () => {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
        <Send size={22} />
      </div>

      <h3 className="mt-4 font-semibold text-[#1d1d1f]">
        No tickets ready to contact
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6e6e73]">
        Tickets will appear here after internal investigation is completed.
      </p>
    </div>
  );
};

const getInitials = (name = '') => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || 'C';
};

export default ReadyToContactPage;