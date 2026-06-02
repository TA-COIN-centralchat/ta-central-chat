import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Eye,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import DashboardLayout from '../components/layout/DashboardLayout';
import { getSessionsByChannel } from '../services/sessionService';
import { subscribeToAllSessions } from '../services/realtimeChat';
import { shortId } from '../utils/format';
import { getCurrentAgentId, getCurrentUserRole } from '../utils/authUtils';

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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 20;

  const [searchTerm, setSearchTerm] = useState('');
  const [sessionFilter, setSessionFilter] = useState('All');

  // Access scoping: Admin sees every session on the channel; agents see only
  // sessions assigned to them.
  const currentAgentId = getCurrentAgentId();
  const isAdmin = getCurrentUserRole() === 'Admin';
  const scopedAgentId = isAdmin ? null : currentAgentId;

  const loadChannelSessions = async (targetPage = 1, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const data = await getSessionsByChannel(
        channelName,
        targetPage,
        PAGE_SIZE,
        scopedAgentId ? { assignedAgentId: scopedAgentId } : {},
      );

      if (append) {
        setSessions((prev) => [...prev, ...(data || [])]);
      } else {
        setSessions(data || []);
      }

      setHasMore(data?.length === PAGE_SIZE);
    } catch (error) {
      console.error(`Failed to load ${channelName} sessions:`, error);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    loadChannelSessions(1, false);

    const sessionSub = subscribeToAllSessions((eventType, newSession, oldSession) => {
      // For non-admin viewers, ignore events that don't touch their sessions.
      // We can't perfectly filter by channel without re-running the channel
      // detection here, so we let those through to the reload — getSessionsByChannel
      // will only return the agent's rows anyway.
      if (!isAdmin) {
        const wasMine = oldSession?.assigned_agent_id === scopedAgentId;
        const isMine = newSession?.assigned_agent_id === scopedAgentId;
        if (!wasMine && !isMine) return;
      }

      setPage(1);
      loadChannelSessions(1, false);
    });

    return () => {
      sessionSub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadChannelSessions(nextPage, true);
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
      <div className="mx-auto w-full max-w-7xl">
        <section className="overflow-hidden rounded-2xl border border-black/6 bg-white/90 shadow-[0_14px_40px_rgba(0,0,0,0.035)] backdrop-blur sm:rounded-[28px]">
          <div className="flex flex-col justify-between gap-4 border-b border-black/6 px-4 py-4 sm:px-5 lg:flex-row lg:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
                <MessageCircle size={19} />
              </div>

              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[#1d1d1f] sm:text-lg">
                  {channelName} Session Inbox
                </h2>

                <p className="mt-1 max-w-3xl text-xs leading-6 text-[#6e6e73] sm:text-sm">
                  {isTelegramChannel(channelName)
                    ? 'Customer conversations from Telegram bot. Open a session to reply to the Telegram customer.'
                    : 'Customer conversations from this channel. Open a session first, then raise a ticket inside the session only if the customer has a real issue.'}
                </p>
              </div>
            </div>

          </div>

          <div className="border-b border-black/6 px-4 py-4 sm:px-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px] md:grid-cols-[1fr_220px]">
              <div className="system-input flex h-11 items-center gap-3 rounded-2xl px-4">
                <Search size={16} className="shrink-0 text-[#8e8e93]" />

                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search customer, session, message..."
                  className="w-full min-w-0 bg-transparent text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
                />
              </div>

              <select
                value={sessionFilter}
                onChange={(event) => setSessionFilter(event.target.value)}
                className="system-input h-11 w-full rounded-2xl px-4 text-sm text-[#1d1d1f] outline-none"
              >
                {sessionStatusOptions.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-44 items-center justify-center p-6 text-sm text-[#6e6e73] sm:p-8">
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

              {hasMore && (
                <div className="flex justify-center border-t border-black/5 bg-[#fbfbfd] p-4 sm:p-6">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black/[0.07] bg-white px-6 py-2.5 text-sm font-semibold text-[#6e6e73] shadow-sm transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Loading more...
                      </>
                    ) : (
                      <>
                        Load More
                        <Plus size={16} />
                      </>
                    )}
                  </button>
                </div>
              )}
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

  const isTelegram = String(session.channel || '').toLowerCase().trim() === 'telegram';

  return (
    <article className="grid gap-4 px-4 py-4 transition hover:bg-[#f8fafc] sm:px-5 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_160px_120px] xl:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eef9fd] text-[#2389b8] ring-1 ring-[#43acd6]/15">
          {session.avatarUrl ? (
            <img
              src={session.avatarUrl}
              alt={session.customer}
              className="h-full w-full object-cover"
            />
          ) : (
            isTelegram ? (
              <Bot size={20} />
            ) : (
              <UserRound size={18} />
            )
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
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

      <div className="grid grid-cols-2 gap-3 text-sm xl:grid-cols-1">
        <Info label="Session" value={shortId(session.id)} />
        <Info label="Created" value={session.time} />
      </div>

      <div className="flex justify-stretch md:justify-end">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#43acd6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:bg-[#2389b8] md:w-auto"
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

export default ChannelTicketsPage;