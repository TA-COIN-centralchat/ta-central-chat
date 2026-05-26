import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import { getTickets } from "../services/ticketService";

const ReadyToContactPage = () => {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadReadyTickets = async () => {
      try {
        setLoading(true);

        const data = await getTickets();

        const filteredTickets = data.filter(
          (ticket) => ticket.status === "Ready to Contact Customer",
        );

        setTickets(filteredTickets);
      } catch (error) {
        console.error("Failed to load ready-to-contact tickets:", error);
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

  const openTicket = (ticket) => {
    navigate(`/tickets/${ticket.dbId}`, {
      state: {
        from: "/ready-to-contact",
        fromLabel: "Ready to Contact",
      },
    });
  };

  return (
    <DashboardLayout
      title="Ready to Contact"
      description="Tickets where internal investigation is complete and the customer needs to be contacted."
    >
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="font-semibold text-slate-950">
              Customer Follow-up Queue
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {filteredTickets.length} of {tickets.length} ready-to-contact
              tickets shown.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search ticket, customer, channel, transaction..."
              className="w-full rounded-xl border border-slate-200 h-10 px-3 text-sm outline-none focus:border-blue-500 md:w-96"
            />

            <span className="inline-flex items-center rounded-full bg-blue-50 h-10 px-4 text-sm font-medium text-blue-700">
              {tickets.length} Ready
            </span>
          </div>
        </div>

        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Ticket ID</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Channel</th>
                  <th className="px-5 py-3">Issue Type</th>
                  <th className="px-5 py-3">Assigned To</th>
                  <th className="px-5 py-3">Transaction</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 w-full rounded bg-slate-100"></div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-lg font-semibold text-slate-900">
              No tickets ready to contact
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Tickets will appear here after internal investigation is
              completed.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Ticket ID</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Channel</th>
                  <th className="px-5 py-3">Issue Type</th>
                  <th className="px-5 py-3">Assigned To</th>
                  <th className="px-5 py-3">Transaction</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.dbId}
                    onClick={() => openTicket(ticket)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                      {ticket.id}
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">
                        {ticket.customer}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {ticket.phone ||
                          ticket.telegram ||
                          ticket.email ||
                          "No contact"}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {ticket.channel}
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800">
                        {ticket.category}
                      </div>

                      <div className="mt-1 max-w-xs truncate text-xs text-slate-500">
                        {ticket.subCategory || ticket.lastMessage}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {ticket.assignedTo}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {ticket.transactionId || "N/A"}
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                        {ticket.status}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openTicket(ticket);
                        }}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
                      >
                        <Eye size={16} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ReadyToContactPage;
