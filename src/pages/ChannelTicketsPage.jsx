import { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Loader2,
  MessageCircle,
  Plus,
  Search,
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

  const loadChannelSessions = async () => {
    try {
      setLoading(true);
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

    const sessionSub = supabase
      .channel(`channel-sessions-${channelName}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_sessions',
          filter: `channel=eq.${channelName}`,
        },
        () => {
          loadChannelSessions();
        },
      )
      .subscribe();

    const messageSub = supabase
      .channel(`channel-messages-${channelName}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        () => {
          loadChannelSessions();
        },
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

  return (
    <DashboardLayout title={title} description={description}>
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[28px] border border-black/6 bg-white/90 shadow-[0_14px_40px_rgba(0,0,0,0.035)] backdrop-blur">
          <div className="flex flex-col justify-between gap-4 border-b border-black/6 px-5 py-4 lg:flex-row lg:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
                <MessageCircle size={19} />
              </div>

              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">
                  {channelName} Session Inbox
                </h2>

                <p className="mt-1 max-w-3xl text-sm leading-6 text-[#6e6e73]">
                  {isTelegramChannel(channelName)
                    ? 'Customer conversations from Telegram bot. Open a session to reply to the Telegram customer.'
                    : 'Customer conversations from this channel. Open a session first, then raise a ticket inside the session only if the customer has a real issue.'}
                </p>
              </div>
            </div>

            {!isTelegramChannel(channelName) && (
              <button
                type="button"
                onClick={handleCreateTestSession}
                disabled={creatingTest}
                className="inline-flex w-fit items-center justify-center gap-2 rounded-2xl border border-black/[0.07] bg-[#f5f5f7] px-4 py-3 text-sm font-medium text-[#6e6e73] transition hover:bg-white hover:text-[#1d1d1f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingTest ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                {creatingTest ? 'Creating...' : 'Create Test Session'}
              </button>
            )}
          </div>

          <div className="border-b border-black/6 px-5 py-4">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <div className="system-input flex h-11 items-center gap-3 rounded-2xl px-4">
                <Search size={16} className="shrink-0 text-[#8e8e93]" />

                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search customer, session, message..."
                  className="w-full bg-transparent text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
                />
              </div>

              <select
                value={sessionFilter}
                onChange={(event) => setSessionFilter(event.target.value)}
                className="system-input h-11 rounded-2xl px-4 text-sm text-[#1d1d1f] outline-none"
              >
                {sessionStatusOptions.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-44 items-center justify-center p-8 text-sm text-[#6e6e73]">
              <div className="text-center">
                <Loader2
                  size={24}
                  className="mx-auto mb-3 animate-spin text-[#43acd6]"
                />
                Loading sessions...
              </div>
            </div>
          ) : filteredSessions.length === 0 ? (
            <EmptyState channelName={channelName} />
          ) : (
            <div className="divide-y divide-black/5">
              {filteredSessions.map((session) => (
                <SessionRow
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

const SessionRow = ({ session, onOpen }) => {
  const contact =
    session.phone ||
    session.telegram ||
    session.email ||
    'No contact provided';

  const message = session.lastMessage || 'No message yet.';
  const issueType = session.issueType || 'General Conversation';

  return (
    <article className="grid gap-4 px-5 py-4 transition hover:bg-[#f8fafc] lg:grid-cols-[minmax(260px,1fr)_minmax(280px,1.15fr)_170px_150px] lg:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef9fd] text-[#2389b8] ring-1 ring-[#43acd6]/15">
          <UserRound size={18} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3
              title={session.customer}
              className="truncate font-semibold text-[#1d1d1f]"
            >
              {session.customer}
            </h3>

            <SessionBadge status={session.status} />
          </div>

          <p title={contact} className="mt-1 truncate text-xs text-[#8e8e93]">
            {contact}
          </p>
        </div>
      </div>

      <div className="min-w-0">
        <div
          title={issueType}
          className="mb-2 inline-flex max-w-full rounded-full border border-[#43acd6]/15 bg-[#eef9fd] px-3 py-1 text-xs font-medium text-[#2389b8]"
        >
          <span className="truncate">Issue Type: {issueType}</span>
        </div>

        <p
          title={message}
          className="line-clamp-2 text-sm leading-6 text-[#6e6e73]"
        >
          {message}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-1">
        <Info label="Session" value={shortId(session.id)} />
        <Info label="Created" value={session.time} />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#43acd6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:bg-[#2389b8]"
        >
          Open
          <Eye size={16} />
        </button>
      </div>
    </article>
  );
};

const SessionBadge = ({ status }) => {
  const className =
    status === 'Active'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
      : status === 'Waiting'
      ? 'bg-orange-50 text-orange-700 ring-orange-100'
      : status === 'Idle Warning'
      ? 'bg-orange-50 text-orange-700 ring-orange-100'
      : 'bg-slate-100 text-slate-600 ring-slate-200';

  const dotClass =
    status === 'Active'
      ? 'bg-emerald-500'
      : status === 'Waiting'
      ? 'bg-orange-500'
      : status === 'Idle Warning'
      ? 'bg-orange-500'
      : 'bg-slate-400';

  return (
    <span
      title={status}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {status}
    </span>
  );
};

const Info = ({ label, value }) => (
  <div className="min-w-0">
    <div className="text-[11px] font-medium text-[#8e8e93]">{label}</div>
    <div
      title={value}
      className="mt-1 truncate text-sm font-medium text-[#1d1d1f]"
    >
      {value}
    </div>
  </div>
);

const EmptyState = ({ channelName }) => (
  <div className="p-10 text-center">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
      <MessageCircle size={22} />
    </div>

    <h3 className="mt-4 font-semibold text-[#1d1d1f]">No sessions found</h3>

    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6e6e73]">
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