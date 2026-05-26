import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ChatWindow from "../components/tickets/ChatWindow";
import TicketDetailsPanel from "../components/tickets/TicketDetailsPanel";
import { getTickets } from "../services/ticketService";
import { useLayout } from "../context/LayoutContext";

const TicketDetailPage = () => {
  const { setTitle, setDescription } = useLayout();

  useEffect(() => {
    setTitle("Ticket Workspace");
    setDescription("View customer conversation, ticket information, and support actions.");
  }, [setTitle, setDescription]);

  const { ticketId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const fromPath = location.state?.from || "/tickets";
  const fromLabel = location.state?.fromLabel || "All Tickets";

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadTicket = async () => {
    try {
      setLoading(true);

      const tickets = await getTickets();
      const foundTicket = tickets.find((item) => item.dbId === ticketId);

      setTicket(foundTicket || null);
    } catch (error) {
      console.error("Failed to load ticket detail:", error);
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
    <>
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          Loading ticket workspace...
        </div>
      ) : !ticket ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            Ticket not found
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            This ticket may have been deleted or the link is invalid.
          </p>

          <button
            type="button"
            onClick={() => navigate(fromPath)}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Back to {fromLabel}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => navigate(fromPath)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
                  title={`Back to ${fromLabel}`}
                >
                  <ArrowLeft size={18} />
                </button>

                <div>
                  <div className="text-xs text-slate-500">
                    {fromLabel} / Ticket Workspace
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">
                    {ticket.id}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {ticket.customer} · {ticket.channel} · {ticket.category}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  {ticket.status}
                </span>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  Assigned to {ticket.assignedTo}
                </span>
              </div>
            </div>
          </div>

          <div className="grid min-h-[calc(100vh-230px)] gap-4 lg:grid-cols-[1fr_360px]">
            <ChatWindow ticket={ticket} onTicketUpdated={loadTicket} />

            <TicketDetailsPanel ticket={ticket} onTicketUpdated={loadTicket} />
          </div>
        </div>
      )}
    </>
  );
};

export default TicketDetailPage;
