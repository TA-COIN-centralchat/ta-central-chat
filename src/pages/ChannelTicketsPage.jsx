import { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Eye,
  MessageCircle,
  Plus,
  Search,
  Star,
  UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import DashboardLayout from '../components/layout/DashboardLayout';
import {
  createTestSession,
  getSessionsByChannel,
} from '../services/sessionService';
import { supabase } from '../services/supabaseClient';

const sessionStatusOptions = [
  'All',
  'Waiting',
  'Active',
  'Idle Warning',
  'Ended',
];

const isTelegramChannel = (channelName) => {
  return channelName?.toLowerCase() === 'telegram';
};

const mapChatSessionStatus = (status) => {
  const value = String(status || '').toLowerCase();

  if (value === 'waiting') return 'Waiting';
  if (value === 'active') return 'Active';
  if (value === 'closed' || value === 'ended') return 'Ended';

  return status || 'Waiting';
};

const mapTelegramSession = (session, latestMessages = {}) => {
  const metadata = session.metadata || {};
  const latestMessage = latestMessages[session.id];

  return {
    dbId: session.id,
    id: session.id,

    customer:
      metadata.customerName ||
      metadata.fullName ||
      session.user_id ||
      'Telegram Customer',

    phone: metadata.phone || '',

    telegram: metadata.telegramUsername
      ? `@${metadata.telegramUsername}`
      : metadata.telegramChatId || '',

    email: '',
    accountId: '',

    channel: session.channel || metadata.channel || 'Telegram',
    status: mapChatSessionStatus(session.status),

    rating: null,

    time: session.created_at
      ? new Date(session.created_at).toLocaleString()
      : 'N/A',

    createdAt: session.created_at,

    lastMessage:
      latestMessage?.content ||
      metadata.issueDescription ||
      'No message yet.',

    issueType: metadata.issueType || '',
    issueDescription: metadata.issueDescription || '',

    assignedAgentName:
      metadata.assignedAgentName || session.agent_id || 'Unassigned',

    raw: session,
  };
};

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

  const [searchTerm, setSearchTerm] = useState('');
  const [sessionFilter, setSessionFilter] = useState('All');

  const loadTelegramSessions = async () => {
    const { data: telegramSessions, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('channel', 'Telegram')
      .in('status', ['waiting', 'active', 'closed'])
      .order('created_at', { ascending: false });

    if (sessionError) {
      throw sessionError;
    }

    const sessionIds = (telegramSessions || []).map((session) => session.id);

    let latestMessages = {};

    if (sessionIds.length > 0) {
      const { data: messages, error: messageError } = await supabase
        .from('chat_messages')
        .select('*')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false });

      if (messageError) {
        throw messageError;
      }

      latestMessages = (messages || []).reduce((acc, message) => {
        if (!acc[message.session_id]) {
          acc[message.session_id] = message;
        }

        return acc;
      }, {});
    }

    return (telegramSessions || []).map((session) =>
      mapTelegramSession(session, latestMessages)
    );
  };

  const loadChannelSessions = async () => {
    try {
      setLoading(true);

      if (isTelegramChannel(channelName)) {
        const data = await loadTelegramSessions();
        setSessions(data);
        return;
      }

      const data = await getSessionsByChannel(channelName);
      setSessions(data || []);
    } catch (error) {
      console.error(`Failed to load ${channelName} sessions:`, error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadChannelSessions();

    if (!isTelegramChannel(channelName)) {
      return undefined;
    }

    const sessionSub = supabase
      .channel('telegram-channel-sessions-page')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_sessions',
          filter: 'channel=eq.Telegram',
        },
        () => {
          loadChannelSessions();
        }
      )
      .subscribe();

    const messageSub = supabase
      .channel('telegram-channel-messages-page')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        () => {
          loadChannelSessions();
        }
      )
      .subscribe();

    return () => {
      sessionSub.unsubscribe();
      messageSub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName]);

  const handleCreateTestSession = async () => {
    if (isTelegramChannel(channelName)) {
      alert(
        'Telegram sessions should be created from the Telegram bot, not from a test button.'
      );
      return;
    }

    try {
      setCreatingTest(true);
      await createTestSession(channelName);
      await loadChannelSessions();
    } catch (error) {
      console.error('Failed to create test session:', error);
      alert('Failed to create test session. Please check console.');
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
        session.issueType?.toLowerCase().includes(searchValue) ||
        session.lastMessage?.toLowerCase().includes(searchValue);

      const matchesStatus =
        sessionFilter === 'All' || session.status === sessionFilter;

      return matchesSearch && matchesStatus;
    });
  }, [sessions, searchTerm, sessionFilter]);

  const openSession = (session) => {
    navigate(`${workspaceBasePath}/${session.dbId}`, {
      state: {
        from: workspaceBasePath,
        fromLabel: title,
        mode: isTelegramChannel(channelName) ? 'telegram-chat' : 'session',
        channel: channelName,
      },
    });
  };

  const waitingCount = sessions.filter(
    (session) => session.status === 'Waiting'
  ).length;

  const activeCount = sessions.filter(
    (session) => session.status === 'Active'
  ).length;

  // eslint-disable-next-line no-unused-vars
  const idleCount = sessions.filter(
    (session) => session.status === 'Idle Warning'
  ).length;

  const endedCount = sessions.filter(
    (session) => session.status === 'Ended'
  ).length;

  const ratedCount = sessions.filter((session) => session.rating).length;

  return (
    <DashboardLayout title={title} description={description}>
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {isTelegramChannel(channelName) ? (
            <SummaryCard
              label="Waiting"
              value={waitingCount}
              icon={Clock}
              tone="orange"
            />
          ) : (
            <SummaryCard
              label="Active"
              value={activeCount}
              icon={MessageCircle}
              tone="emerald"
            />
          )}

          <SummaryCard
            label="Active"
            value={activeCount}
            icon={MessageCircle}
            tone="emerald"
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
                  {isTelegramChannel(channelName)
                    ? 'Customer conversations from Telegram bot. Open a session to reply to the Telegram customer.'
                    : 'Customer conversations from this channel. Open a session first, then raise a ticket inside the session only if the customer has a real issue.'}
                </p>
              </div>

              {!isTelegramChannel(channelName) && (
                <button
                  type="button"
                  onClick={handleCreateTestSession}
                  disabled={creatingTest}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus size={16} />
                  {creatingTest ? 'Creating...' : 'Create Test Session'}
                </button>
              )}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
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
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {sessionStatusOptions.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading sessions...
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
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    orange: 'bg-orange-50 text-orange-700',
    slate: 'bg-slate-100 text-slate-700',
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
                'No contact provided'}
            </p>
          </div>
        </div>

        <SessionBadge status={session.status} />
      </div>

      {session.issueType && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
          <span className="font-semibold">Issue Type:</span>{' '}
          {session.issueType}
        </div>
      )}

      <div className="mt-4 rounded-xl bg-slate-50 p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Last Message
        </div>

        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">
          {session.lastMessage || 'No message yet.'}
        </p>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
        <Info label="Session" value={shortId(session.id)} />
        <Info label="Created" value={session.time} />
        <Info
          label="Rating"
          value={session.rating ? `${session.rating}/5` : 'N/A'}
        />
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
    status === 'Active'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'Waiting'
      ? 'bg-orange-50 text-orange-700'
      : status === 'Idle Warning'
      ? 'bg-orange-50 text-orange-700'
      : 'bg-slate-100 text-slate-600';

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

const shortId = (id) => {
  if (!id) return 'N/A';
  return String(id).length > 12 ? `${String(id).slice(0, 8)}...` : id;
};

export default ChannelTicketsPage;