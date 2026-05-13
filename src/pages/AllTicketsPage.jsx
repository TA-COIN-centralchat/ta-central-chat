import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import ChatWindow from '../components/tickets/ChatWindow';
import TicketCard from '../components/tickets/TicketCard';
import TicketDetailsPanel from '../components/tickets/TicketDetailsPanel';
import { getTickets } from '../services/ticketService';

const statusTabs = [
  'All',
  'New',
  'Assigned',
  'In Progress',
  'Waiting for Customer',
  'Pending Investigation',
  'Resolved',
  'Closed',
];

const AllTicketsPage = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeStatus, setActiveStatus] = useState('All');

  const loadTickets = async () => {
    try {
      setLoading(true);

      const data = await getTickets();

      setTickets(data);

      if (selectedTicket) {
        const updatedSelectedTicket = data.find(
          (ticket) => ticket.dbId === selectedTicket.dbId
        );

        setSelectedTicket(updatedSelectedTicket || data[0] || null);
      } else {
        setSelectedTicket(data[0] || null);
      }
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTicketUpdated = async () => {
    await loadTickets();
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const searchValue = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !searchValue ||
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
        ticket.transactionId?.toLowerCase().includes(searchValue);

      const matchesStatus =
        activeStatus === 'All' || ticket.status === activeStatus;

      return matchesSearch && matchesStatus;
    });
  }, [tickets, searchTerm, activeStatus]);

  useEffect(() => {
    if (filteredTickets.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedTicket(null);
      return;
    }

    const selectedStillVisible = filteredTickets.some(
      (ticket) => ticket.dbId === selectedTicket?.dbId
    );

    if (!selectedStillVisible) {
      setSelectedTicket(filteredTickets[0]);
    }
  }, [filteredTickets, selectedTicket?.dbId]);

  return (
    <DashboardLayout
      title="All Tickets"
      description="Manage all customer conversations and support tickets."
    >
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          Loading tickets...
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            No tickets found
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Tickets from Supabase will appear here.
          </p>
        </div>
      ) : (
        <div className="grid h-[calc(100vh-130px)] grid-cols-[360px_1fr_340px] gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Ticket Inbox
                  </div>
                  <div className="text-xs text-slate-500">
                    {filteredTickets.length} of {tickets.length} tickets shown
                  </div>
                </div>

                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  {tickets.length} Total
                </span>
              </div>

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search ticket, customer, phone, Telegram, issue..."
                className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {statusTabs.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setActiveStatus(status)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition ${
                      activeStatus === status
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 overflow-y-auto p-3">
              {filteredTickets.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-center">
                  <div className="font-semibold text-slate-900">
                    No matching tickets
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Try changing the search keyword or status filter.
                  </p>
                </div>
              ) : (
                filteredTickets.map((ticket) => (
                  <div
                    key={ticket.dbId}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <TicketCard
                      ticket={ticket}
                      active={ticket.dbId === selectedTicket?.dbId}
                    />
                  </div>
                ))
              )}
            </div>
          </section>

          {selectedTicket ? (
            <>
              <ChatWindow
                ticket={selectedTicket}
                onTicketUpdated={handleTicketUpdated}
              />

              <TicketDetailsPanel
                ticket={selectedTicket}
                onTicketUpdated={handleTicketUpdated}
              />
            </>
          ) : (
            <section className="col-span-2 flex items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-slate-900">
                  No ticket selected
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Select a ticket from the list or adjust your filters.
                </p>
              </div>
            </section>
          )}
        </div>
      )}
    </DashboardLayout>
  );
};

export default AllTicketsPage;