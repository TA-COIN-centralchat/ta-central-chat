/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  FileText,
  Loader2,
  MessageCircle,
  Ticket,
  UserRound,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import DashboardLayout from '../components/layout/DashboardLayout';
import ChatWindow from '../components/tickets/ChatWindow';
import TicketDetailsPanel from '../components/tickets/TicketDetailsPanel';
import { getTickets } from '../services/ticketService';

const TicketDetailPage = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const fromPath = location.state?.from || '/tickets';
  const fromLabel = location.state?.fromLabel || 'All Tickets';

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadTicket = async () => {
    try {
      setLoading(true);

      const tickets = await getTickets();
      const foundTicket = tickets.find((item) => item.dbId === ticketId);

      setTicket(foundTicket || null);
    } catch (error) {
      console.error('Failed to load ticket detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  return (
    <DashboardLayout
      title="Ticket Workspace"
      description="View customer conversation, ticket information, and support actions."
    >
      {loading ? (
        <div className="flex min-h-72 items-center justify-center rounded-[28px] border border-[#e8edf2] bg-white p-10 text-center text-sm text-[#6e6e73] shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
          <div>
            <Loader2
              size={24}
              className="mx-auto mb-3 animate-spin text-[#43acd6]"
            />
            Loading ticket workspace...
          </div>
        </div>
      ) : !ticket ? (
        <div className="rounded-[28px] border border-[#e8edf2] bg-white p-10 text-center shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
            <Ticket size={22} />
          </div>

          <h2 className="mt-4 text-lg font-semibold text-[#1d1d1f]">
            Ticket not found
          </h2>

          <p className="mt-2 text-sm text-[#6e6e73]">
            This ticket may have been deleted or the link is invalid.
          </p>

          <button
            type="button"
            onClick={() => navigate(fromPath)}
            className="mt-5 rounded-2xl bg-[#43acd6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:bg-[#2389b8]"
          >
            Back to {fromLabel}
          </button>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl space-y-5">
          <section className="overflow-hidden rounded-[28px] border border-[#e8edf2] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-4 border-b border-[#edf1f5] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <button
                  type="button"
                  onClick={() => navigate(fromPath)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#e5e7eb] bg-[#f8fafc] text-[#6e6e73] transition hover:bg-white hover:text-[#1d1d1f]"
                  title={`Back to ${fromLabel}`}
                >
                  <ArrowLeft size={18} />
                </button>

                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#8e8e93]">
                    {fromLabel} / Ticket Workspace
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h2
                      title={ticket.id}
                      className="max-w-105 truncate text-xl font-semibold tracking-[-0.03em] text-[#1d1d1f]"
                    >
                      {ticket.id}
                    </h2>

                    <StatusBadge status={ticket.status} />
                  </div>

                  <p
                    title={`${ticket.customer || ''} · ${ticket.channel || ''} · ${
                      ticket.category || ''
                    }`}
                    className="mt-1 max-w-2xl truncate text-sm text-[#6e6e73]"
                  >
                    {ticket.customer || 'Unknown customer'} ·{' '}
                    {ticket.channel || 'Unknown channel'} ·{' '}
                    {ticket.category || 'No issue type'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <InfoPill
                  label={`Assigned to ${ticket.assignedTo || 'Unassigned'}`}
                />
              </div>
            </div>

            <div className="grid gap-0 divide-y divide-[#edf1f5] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
              <SummaryBlock
                icon={UserRound}
                title="Customer Information"
                rows={[
                  ['Name', ticket.customer || 'Unknown customer'],
                  [
                    'Contact',
                    ticket.phone ||
                      ticket.telegram ||
                      ticket.email ||
                      'No contact provided',
                  ],
                  ['Channel', ticket.channel || 'Unknown'],
                ]}
              />

              <SummaryBlock
                icon={FileText}
                title="Issue Summary"
                rows={[
                  ['Issue Type', ticket.category || 'N/A'],
                  ['Sub Issue', ticket.subCategory || 'N/A'],
                  ['Transaction ID', ticket.transactionId || 'N/A'],
                ]}
              />

              <SummaryBlock
                icon={Clock}
                title="Ticket Status"
                rows={[
                  ['Status', ticket.status || 'Unknown'],
                  ['Assigned To', ticket.assignedTo || 'Unassigned'],
                  ['Created / Updated', ticket.time || 'N/A'],
                ]}
              />
            </div>
          </section>

          <div className="grid gap-5 xl:h-[calc(100vh-305px)] xl:min-h-150 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-h-150 overflow-hidden rounded-[28px] border border-[#e8edf2] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04)] xl:min-h-0">
              <ChatWindow ticket={ticket} onTicketUpdated={loadTicket} />
            </div>

            <div className="min-h-150 overflow-hidden rounded-[28px] border border-[#e8edf2] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04)] xl:min-h-0">
              <TicketDetailsPanel
                ticket={ticket}
                onTicketUpdated={loadTicket}
              />
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

const SummaryBlock = ({ icon: Icon, title, rows }) => {
  return (
    <div className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#f7fbfd] text-[#2389b8] ring-1 ring-[#d8eef7]">
          <Icon size={17} />
        </div>

        <h3 className="text-sm font-semibold text-[#1d1d1f]">{title}</h3>
      </div>

      <div className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[105px_1fr] gap-3 text-sm">
            <span className="text-[#8e8e93]">{label}</span>

            <span title={value} className="truncate font-medium text-[#4b5563]">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const normalized = status?.toLowerCase().trim();

  const className =
    normalized === 'resolved' || normalized === 'closed'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
      : normalized === 'pending investigation' ||
        normalized === 'pending' ||
        normalized === 'pending review'
      ? 'bg-orange-50 text-orange-700 ring-orange-100'
      : normalized === 'ready to contact customer' ||
        normalized === 'ready to contact'
      ? 'bg-[#f7fbfd] text-[#2389b8] ring-[#d8eef7]'
      : normalized === 'new'
      ? 'bg-[#fff8d6] text-[#8a6d00] ring-[#ffe88a]'
      : 'bg-[#f5f5f7] text-[#6e6e73] ring-[#e5e7eb]';

  const dotClass =
    normalized === 'resolved' || normalized === 'closed'
      ? 'bg-emerald-500'
      : normalized === 'pending investigation' ||
        normalized === 'pending' ||
        normalized === 'pending review'
      ? 'bg-orange-500'
      : normalized === 'ready to contact customer' ||
        normalized === 'ready to contact'
      ? 'bg-[#43acd6]'
      : normalized === 'new'
      ? 'bg-[#ffd84d]'
      : 'bg-[#8e8e93]';

  return (
    <span
      title={status}
      className={`inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      <span className="truncate">{status || 'Unknown'}</span>
    </span>
  );
};

const InfoPill = ({ label }) => {
  return (
    <span
      title={label}
      className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#f8fafc] px-3 py-1.5 text-xs font-medium text-[#6e6e73] ring-1 ring-[#e5e7eb]"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#ffd84d]" />
      <span className="truncate">{label}</span>
    </span>
  );
};

export default TicketDetailPage;