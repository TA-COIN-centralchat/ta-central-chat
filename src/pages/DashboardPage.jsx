import { useEffect, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Inbox,
  MessageCircle,
  Send,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAgents, getTickets } from "../services/ticketService";
import { useLayout } from "../context/LayoutContext";

const DashboardPage = () => {
  const { setTitle, setDescription } = useLayout();

  useEffect(() => {
    setTitle("Dashboard");
    setDescription("Overview of Central Chat ticket operations.");
  }, [setTitle, setDescription]);

  const navigate = useNavigate();

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ["tickets"],
    queryFn: getTickets,
    staleTime: 60000,
  });

  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["agents"],
    queryFn: getAgents,
    staleTime: 60000,
  });

  const loading = loadingTickets || loadingAgents;

  const stats = useMemo(() => {
    const waitingQueue = tickets.filter(
      (ticket) => ticket.status === "New" || ticket.assignedTo === "Unassigned",
    ).length;

    const pendingInvestigation = tickets.filter(
      (ticket) => ticket.status === "Pending Investigation",
    ).length;

    const closedTickets = tickets.filter(
      (ticket) => ticket.status === "Resolved" || ticket.status === "Closed",
    ).length;

    const telegramTickets = tickets.filter(
      (ticket) => ticket.channel === "Telegram",
    ).length;

    const chatbotTickets = tickets.filter(
      (ticket) => ticket.channel === "Website Chatbot",
    ).length;

    const availableAgents = agents.filter(
      (agent) => agent.status === "Available",
    ).length;

    return {
      totalTickets: tickets.length,
      waitingQueue,
      pendingInvestigation,
      closedTickets,
      telegramTickets,
      chatbotTickets,
      totalAgents: agents.length,
      availableAgents,
    };
  }, [tickets, agents]);

  const dashboardCards = [
    {
      title: "All Tickets",
      value: stats.totalTickets,
      description: "View all support tickets",
      icon: Inbox,
      path: "/tickets",
      color: "bg-blue-50 text-blue-700",
    },
    {
      title: "Waiting Queue",
      value: stats.waitingQueue,
      description: "Tickets waiting for assignment",
      icon: Clock,
      path: "/waiting-queue",
      color: "bg-orange-50 text-orange-700",
    },
    {
      title: "Pending Investigation",
      value: stats.pendingInvestigation,
      description: "Tickets requiring internal follow-up",
      icon: AlertTriangle,
      path: "/pending-investigation",
      color: "bg-amber-50 text-amber-700",
    },
    {
      title: "Closed / Resolved",
      value: stats.closedTickets,
      description: "View completed support records",
      icon: CheckCircle,
      path: "/closed-tickets",
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      title: "Telegram Tickets",
      value: stats.telegramTickets,
      description: "Tickets from Telegram channel",
      icon: Send,
      path: "/telegram",
      color: "bg-sky-50 text-sky-700",
    },
    {
      title: "Website Chatbot",
      value: stats.chatbotTickets,
      description: "Tickets from website chatbot",
      icon: MessageCircle,
      path: "/chatbot",
      color: "bg-violet-50 text-violet-700",
    },
    {
      title: "Agents",
      value: stats.totalAgents,
      description: `${stats.availableAgents} available agents`,
      icon: Users,
      path: "/agents",
      color: "bg-slate-100 text-slate-700",
    },
  ];

  const recentTickets = tickets.slice(0, 5);

  return (
    <>
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Loading dashboard...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {dashboardCards.map((card) => {
              const Icon = card.icon;

              return (
                <button
                  key={card.title}
                  type="button"
                  onClick={() => navigate(card.path)}
                  className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-500">{card.title}</p>
                      <div className="mt-3 text-3xl font-semibold text-slate-950">
                        {card.value}
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {card.description}
                      </p>
                    </div>

                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.color}`}
                    >
                      <Icon size={20} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <section className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 p-5">
                <div>
                  <h2 className="font-semibold text-slate-950">
                    Recent Tickets
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Latest customer issues created in the system.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/tickets")}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
                >
                  View All
                </button>
              </div>

              {recentTickets.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  No recent tickets found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Ticket</th>
                        <th className="px-5 py-3">Customer</th>
                        <th className="px-5 py-3">Channel</th>
                        <th className="px-5 py-3">Issue</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Agent</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {recentTickets.map((ticket) => (
                        <tr
                          key={ticket.dbId}
                          onClick={() =>
                            navigate(`/tickets/${ticket.dbId}`, {
                              state: {
                                from: "/dashboard",
                                fromLabel: "Dashboard",
                              },
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              navigate(`/tickets/${ticket.dbId}`, {
                                state: {
                                  from: "/dashboard",
                                  fromLabel: "Dashboard",
                                },
                              });
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className="cursor-pointer hover:bg-slate-50 focus-visible:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                        >
                          <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                            {ticket.id}
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {ticket.customer}
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {ticket.channel}
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {ticket.category}
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge status={ticket.status} />
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {ticket.assignedTo}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-5">
                <h2 className="font-semibold text-slate-950">Agent Status</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Current availability of support staff.
                </p>
              </div>

              {agents.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  No agents found.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {agents.slice(0, 6).map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between gap-4 p-5"
                    >
                      <div>
                        <div className="font-medium text-slate-900">
                          {agent.name}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {agent.role}
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getAgentStatusClass(
                          agent.status,
                        )}`}
                      >
                        {agent.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-slate-200 p-4">
                <button
                  type="button"
                  onClick={() => navigate("/agents")}
                  className="w-full rounded-xl border border-slate-200 h-10 px-4 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  Manage Agents
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
};

const StatusBadge = ({ status }) => {
  const className =
    status === "Resolved" || status === "Closed"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Pending Investigation"
        ? "bg-orange-50 text-orange-700"
        : status === "New"
          ? "bg-blue-50 text-blue-700"
          : "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
};

const getAgentStatusClass = (status) => {
  if (status === "Available") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "Busy") {
    return "bg-orange-50 text-orange-700";
  }

  if (status === "Away") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-slate-100 text-slate-600";
};

export default DashboardPage;
