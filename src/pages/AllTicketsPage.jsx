import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import ChatWindow from '../components/tickets/ChatWindow';
import TicketCard from '../components/tickets/TicketCard';
import TicketDetailsPanel from '../components/tickets/TicketDetailsPanel';
import { getTickets } from '../services/ticketService';

const AllTicketsPage = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);

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
                    All active customer issues
                  </div>
                </div>

                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  {tickets.length} Tickets
                </span>
              </div>

              <input
                placeholder="Search tickets..."
                className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />

              <div className="mt-3 flex gap-2 overflow-x-auto">
                {['All', 'New', 'Assigned', 'In Progress', 'Pending'].map(
                  (item) => (
                    <button
                      key={item}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      {item}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="space-y-2 overflow-y-auto p-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.dbId}
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <TicketCard
                    ticket={ticket}
                    active={ticket.dbId === selectedTicket?.dbId}
                  />
                </div>
              ))}
            </div>
          </section>

          {selectedTicket && (
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
          )}
        </div>
      )}
    </DashboardLayout>
  );
};

export default AllTicketsPage;