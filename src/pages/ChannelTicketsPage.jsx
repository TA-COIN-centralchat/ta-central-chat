import DashboardLayout from '../components/layout/DashboardLayout';
import ChatWindow from '../components/tickets/ChatWindow';
import TicketCard from '../components/tickets/TicketCard';
import TicketDetailsPanel from '../components/tickets/TicketDetailsPanel';
import { tickets } from '../data/mockData';

const ChannelTicketsPage = ({ channelName, title, description }) => {
  const channelTickets = tickets.filter((ticket) => ticket.channel === channelName);
  const selectedTicket = channelTickets[0] || tickets[0];

  return (
    <DashboardLayout title={title} description={description}>
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Channel</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {channelName}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Total Tickets</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {channelTickets.length}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Connection Status</div>
          <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
            Connected
          </div>
        </div>
      </div>

      {channelTickets.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-950">
            No tickets found
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Tickets from {channelName} will appear here.
          </p>
        </div>
      ) : (
        <div className="grid h-[calc(100vh-250px)] grid-cols-[360px_1fr_340px] gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-900">
                {channelName} Tickets
              </div>
              <div className="text-xs text-slate-500">
                Filtered by selected channel
              </div>

              <input
                placeholder="Search tickets..."
                className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-2 overflow-y-auto p-3">
              {channelTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  active={ticket.id === selectedTicket.id}
                />
              ))}
            </div>
          </section>

          <ChatWindow ticket={selectedTicket} />

          <TicketDetailsPanel ticket={selectedTicket} />
        </div>
      )}
    </DashboardLayout>
  );
};

export default ChannelTicketsPage;