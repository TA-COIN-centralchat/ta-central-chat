import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Eye,
  MessageCircle,
  Plus,
  Search,
  Star,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import {
  createTestSession,
  getSessionsByChannel,
} from "../services/sessionService";

const sessionStatusOptions = ["All", "Active", "Idle Warning", "Ended"];

const ChannelTicketsPage = ({
  channelName,
  title,
  description,
  workspaceBasePath,
}) => {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingTest, setCreatingTest] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [sessionFilter, setSessionFilter] = useState("All");

  const loadChannelSessions = async () => {
    try {
      setLoading(true);
      const data = await getSessionsByChannel(channelName);
      setSessions(data);
    } catch (error) {
      console.error(`Failed to load ${channelName} sessions:`, error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadChannelSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName]);

  const handleCreateTestSession = async () => {
    try {
      setCreatingTest(true);
      await createTestSession(channelName);
      await loadChannelSessions();
    } catch (error) {
      console.error("Failed to create test session:", error);
      alert("Failed to create test session. Please check console.");
    } finally {
      setCreatingTest(false);
    }
  };

  const filteredSessions = useMemo(() => {
    const searchValue = searchTerm.toLowerCase().trim();

    return sessions.filter((session) => {
      const matchesSearch =
        !searchValue ||
        session.id?.toLowerCase().includes(searchValue) ||
        session.customer?.toLowerCase().includes(searchValue) ||
        session.channel?.toLowerCase().includes(searchValue) ||
        session.status?.toLowerCase().includes(searchValue) ||
        session.phone?.toLowerCase().includes(searchValue) ||
        session.telegram?.toLowerCase().includes(searchValue) ||
        session.email?.toLowerCase().includes(searchValue) ||
        session.accountId?.toLowerCase().includes(searchValue) ||
        session.lastMessage?.toLowerCase().includes(searchValue);

      const matchesStatus =
        sessionFilter === "All" || session.status === sessionFilter;

      return matchesSearch && matchesStatus;
    });
  }, [sessions, searchTerm, sessionFilter]);

  const openSession = (session) => {
    navigate(`${workspaceBasePath}/${session.dbId}`, {
      state: {
        from: workspaceBasePath,
        fromLabel: title,
        mode: "session",
      },
    });
  };

  const activeCount = sessions.filter(
    (session) => session.status === "Active",
  ).length;

  const idleCount = sessions.filter(
    (session) => session.status === "Idle Warning",
  ).length;

  const endedCount = sessions.filter(
    (session) => session.status === "Ended",
  ).length;

  const ratedCount = sessions.filter((session) => session.rating).length;

  return (
    <DashboardLayout title={title} description={description}>
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Active"
            value={activeCount}
            icon={MessageCircle}
            tone="emerald"
          />

          <SummaryCard
            label="Idle Warning"
            value={idleCount}
            icon={Clock}
            tone="orange"
          />

          <SummaryCard
            label="Ended"
            value={endedCount}
            icon={Eye}
            tone="slate"
          />

          <SummaryCard
            label="Rated"
            value={ratedCount}
            icon={Star}
            tone="blue"
          />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-950">
                  {channelName} Session Inbox
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Customer conversations from this channel. Open a session
                  first, then raise a ticket inside the session only if the
                  customer has a real issue.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCreateTestSession}
                disabled={creatingTest}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={16} />
                {creatingTest ? "Creating..." : "Create Test Session"}
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 h-10 px-3">
                <Search size={16} className="text-slate-400" />

                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search customer, session, message..."
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>

              <select
                value={sessionFilter}
                onChange={(event) => setSessionFilter(event.target.value)}
                className="rounded-xl border border-slate-200 h-10 px-3 text-sm outline-none focus:border-blue-500"
              >
                {sessionStatusOptions.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 p-5 xl:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full bg-slate-100"></div>
                      <div className="space-y-2">
                        <div className="h-4 w-32 rounded bg-slate-100"></div>
                        <div className="h-3 w-24 rounded bg-slate-100"></div>
                      </div>
                    </div>
                    <div className="h-5 w-16 rounded-full bg-slate-100"></div>
                  </div>
                  <div className="mt-4 h-24 rounded-xl bg-slate-50"></div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="h-8 rounded bg-slate-50"></div>
                    <div className="h-8 rounded bg-slate-50"></div>
                    <div className="h-8 rounded bg-slate-50"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredSessions.length === 0 ? (
            <EmptyState channelName={channelName} />
          ) : (
            <div className="grid gap-4 p-5 xl:grid-cols-2">
              {filteredSessions.map((session) => (
                <SessionCard
                  key={session.dbId}
                  session={session}
                  onOpen={() => openSession(session)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

const SummaryCard = ({ label, value, icon: Icon, tone }) => {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    orange: "bg-orange-50 text-orange-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">{label} Sessions</div>
          <div className="mt-2 text-3xl font-semibold text-slate-950">
            {value}
          </div>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneClass[tone]}`}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
};

const SessionCard = ({ session, onOpen }) => {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <UserRound size={18} />
          </div>

          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-950">
              {session.customer}
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              {session.phone ||
                session.telegram ||
                session.email ||
                "No contact provided"}
            </p>
          </div>
        </div>

        <SessionBadge status={session.status} />
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Last Message
        </div>

        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">
          {session.lastMessage || "No message yet."}
        </p>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
        <Info label="Session" value={session.id} />
        <Info label="Created" value={session.time} />
        <Info
          label="Rating"
          value={session.rating ? `${session.rating}/5` : "N/A"}
        />
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition-all hover:bg-blue-700"
        >
          <Eye size={16} />
          Open Session
        </button>
      </div>
    </article>
  );
};

const SessionBadge = ({ status }) => {
  const className =
    status === "Active"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Idle Warning"
        ? "bg-orange-50 text-orange-700"
        : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${className}`}
    >
      {status}
    </span>
  );
};

const Info = ({ label, value }) => (
  <div>
    <div className="text-xs text-slate-400">{label}</div>
    <div className="mt-1 truncate font-medium text-slate-800">{value}</div>
  </div>
);

const EmptyState = ({ channelName }) => (
  <div className="p-12 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
      <MessageCircle size={24} />
    </div>

    <h3 className="mt-4 text-lg font-semibold text-slate-900">
      No sessions found
    </h3>

    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
      Customer sessions from {channelName} will appear here when customers
      contact this channel.
    </p>
  </div>
);

export default ChannelTicketsPage;
