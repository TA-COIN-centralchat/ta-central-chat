import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Headphones,
  Loader2,
  MessageSquare,
  Send,
  Ticket,
  Timer,
  User,
  XCircle,
} from 'lucide-react';

import DashboardLayout from '../components/layout/DashboardLayout';
import {
  getActiveSessions,
  getSessionMessages,
  sendMessage,
  claimSession,
  closeSession,
  processChatSessionTimeouts,
  subscribeToAllSessions,
  subscribeToSessionMessages,
} from '../services/realtimeChat';

const LiveChatPage = () => {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [closing, setClosing] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const msgSubRef = useRef(null);
  const messagesEndRef = useRef(null);

  const agentId =
    localStorage.getItem('currentAgentId') ||
    localStorage.getItem('tacoin_agent_id') ||
    'agent_dashboard';

  const agentName = localStorage.getItem('currentUserName') || 'Agent';

  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoading(true);

        const data = await getActiveSessions();
        setSessions(data || []);
      } catch (err) {
        console.error('Failed to load chat sessions:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();

    const sub = subscribeToAllSessions((eventType, newSession, oldSession) => {
      setSessions((prev) => {
        if (eventType === 'INSERT') {
          if (prev.some((session) => session.id === newSession.id)) {
            return prev;
          }

          if (newSession.status === 'closed') {
            return prev;
          }

          return [...prev, newSession];
        }

        if (eventType === 'UPDATE') {
          if (newSession.status === 'closed') {
            return prev.filter((session) => session.id !== newSession.id);
          }

          return prev.map((session) =>
            session.id === newSession.id ? newSession : session
          );
        }

        if (eventType === 'DELETE') {
          return prev.filter(
            (session) => session.id !== (oldSession?.id || newSession?.id)
          );
        }

        return prev;
      });

      if (eventType === 'UPDATE' && newSession) {
        setSelectedSession((prev) => {
          if (!prev || prev.id !== newSession.id) {
            return prev;
          }

          if (newSession.status === 'closed') {
            return {
              ...newSession,
              _closedWhileViewing: true,
            };
          }

          return newSession;
        });
      }
    });

    return () => {
      sub.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const runTimeoutCheck = async () => {
      try {
        await processChatSessionTimeouts();
      } catch (error) {
        console.error('Failed to process live chat timeout:', error);
      }
    };

    runTimeoutCheck();

    const interval = setInterval(runTimeoutCheck, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (msgSubRef.current) {
        msgSubRef.current.unsubscribe();
        msgSubRef.current = null;
      }
    };
  }, []);

  const selectSession = useCallback(async (session) => {
    if (msgSubRef.current) {
      msgSubRef.current.unsubscribe();
      msgSubRef.current = null;
    }

    setSelectedSession(session);
    setMessages([]);

    try {
      const msgs = await getSessionMessages(session.id);
      setMessages(msgs || []);
    } catch (err) {
      console.error('Failed to load session messages:', err);
    }

    msgSubRef.current = subscribeToSessionMessages(session.id, (msg) => {
      setMessages((prev) => {
        if (prev.some((message) => message.id === msg.id)) {
          return prev;
        }

        return [...prev, msg];
      });
    });
  }, []);

  const handleClaim = async (session) => {
    try {
      setClaiming(true);

      const claimed = await claimSession(session.id, agentId);
      setSelectedSession(claimed);

      await sendMessage(
        session.id,
        'system',
        agentId,
        `${agentName} has joined the chat.`,
        { agentName }
      );

      const msgs = await getSessionMessages(session.id);
      setMessages(msgs || []);

      if (msgSubRef.current) {
        msgSubRef.current.unsubscribe();
      }

      msgSubRef.current = subscribeToSessionMessages(session.id, (msg) => {
        setMessages((prev) => {
          if (prev.some((message) => message.id === msg.id)) {
            return prev;
          }

          return [...prev, msg];
        });
      });
    } catch (err) {
      console.error('Failed to claim session:', err);
      alert('Failed to claim session. It may have been claimed by another agent.');
    } finally {
      setClaiming(false);
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();

    if (!input.trim() || !selectedSession || sending) {
      return;
    }

    const text = input.trim();
    setInput('');

    try {
      setSending(true);

      await sendMessage(selectedSession.id, 'agent', agentId, text, {
        agentName,
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    if (!selectedSession) {
      return;
    }

    const confirmed = window.confirm(
      'End this chat session? This will not create a ticket automatically. Create a ticket first if the customer has a real issue.'
    );

    if (!confirmed) {
      return;
    }

    try {
      setClosing(true);

      await sendMessage(
        selectedSession.id,
        'system',
        agentId,
        'Session ended by agent.',
        { agentName }
      );

      await closeSession(selectedSession.id);

      if (msgSubRef.current) {
        msgSubRef.current.unsubscribe();
        msgSubRef.current = null;
      }

      setSelectedSession(null);
      setMessages([]);
    } catch (err) {
      console.error('Failed to close session:', err);
      alert('Failed to close session. Please try again.');
    } finally {
      setClosing(false);
    }
  };

  const handleCreateTicket = () => {
    if (!selectedSession) {
      return;
    }

    const latestCustomerMessage = getLatestCustomerMessage(messages);

    navigate('/manual-ticket', {
      state: {
        fromSession: true,
        from: '/live-chat',
        fromLabel: 'Live Chat',

        sessionId: selectedSession.id,
        sessionNumber: selectedSession.id,

        customerName:
          selectedSession.metadata?.customerName ||
          selectedSession.metadata?.name ||
          selectedSession.user_id ||
          'Unknown Customer',

        phone: selectedSession.metadata?.phone || '',

        telegram:
          selectedSession.metadata?.telegram ||
          selectedSession.metadata?.telegram_username ||
          '',

        email: selectedSession.metadata?.email || '',

        accountId:
          selectedSession.metadata?.accountId ||
          selectedSession.metadata?.ta_coin_user_id ||
          '',

        channel: 'Website Chatbot',

        issueDescription:
          latestCustomerMessage ||
          selectedSession.metadata?.description ||
          'Created from live chat session.',

        internalNote: `Created from live chat session: ${selectedSession.id}`,
      },
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) {
      return '-';
    }

    return new Date(dateStr).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    if (status === 'waiting') {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-100">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Waiting
        </span>
      );
    }

    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Active
        </span>
      );
    }

    if (status === 'closed') {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 ring-1 ring-red-100">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          Ended
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
        {status || 'Unknown'}
      </span>
    );
  };

  const getSessionTimerLabel = (session) => {
    const expiresAt = session?.metadata?.expiresAt;

    if (!expiresAt || session.status !== 'active') {
      return null;
    }

    const remainingMs = new Date(expiresAt).getTime() - currentTime;

    if (remainingMs <= 0) {
      return {
        text: 'Expired',
        warning: true,
      };
    }

    const remainingMinutes = Math.ceil(remainingMs / 60000);

    return {
      text: `${remainingMinutes} min left`,
      warning: remainingMinutes <= 2,
    };
  };

  const endedCount = sessions.filter(
    (session) => session.status === 'closed'
  ).length;

  const activeCount = sessions.filter(
    (session) => session.status === 'active'
  ).length;

  const sortedSessions = [...sessions].sort((a, b) => {
    return (
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
    );
  });

  const selectedTimer = getSessionTimerLabel(selectedSession);

  return (
    <DashboardLayout
      title="Live Chat"
      description="Real-time chat sessions from the website chatbot. Create tickets only when the customer has a real issue."
    >
      <div className="mx-auto max-w-7xl">
        <section className="grid h-[calc(100vh-150px)] min-h-155 grid-cols-1 gap-5 xl:grid-cols-[360px_1fr]">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-black/6 bg-white/90 shadow-[0_14px_40px_rgba(0,0,0,0.035)] backdrop-blur">
            <div className="border-b border-black/6 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[#1d1d1f]">
                    Chat Sessions
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-[#6e6e73]">
                    Live website conversations appear here in real time.
                  </p>
                </div>

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
                  <Headphones size={19} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill label="Ended" value={endedCount} tone="red" />
                <StatusPill label="Active" value={activeCount} tone="green" />
                <StatusPill label="Total" value={sessions.length} tone="blue" />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex h-full items-center justify-center p-8 text-sm text-[#6e6e73]">
                  <div className="text-center">
                    <Loader2
                      size={24}
                      className="mx-auto mb-3 animate-spin text-[#43acd6]"
                    />
                    Loading sessions...
                  </div>
                </div>
              ) : sortedSessions.length === 0 ? (
                <div className="flex h-full items-center justify-center p-8 text-center">
                  <div>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
                      <MessageSquare size={22} />
                    </div>

                    <p className="mt-4 text-sm font-semibold text-[#1d1d1f]">
                      No active sessions
                    </p>

                    <p className="mx-auto mt-1 max-w-56 text-xs leading-5 text-[#6e6e73]">
                      New website chat sessions will appear here automatically.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-black/5">
                  {sortedSessions.map((session) => {
                    const isSelected = selectedSession?.id === session.id;
                    const description =
                      session.metadata?.description || 'No description';
                    const sessionUserId = session.user_id || 'Unknown user';
                    const timer = getSessionTimerLabel(session);

                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => selectSession(session)}
                        className={`w-full px-4 py-4 text-left transition ${
                          isSelected
                            ? 'bg-[#eef9fd]'
                            : 'hover:bg-[#f8fafc]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ${
                              isSelected
                                ? 'bg-[#43acd6] text-white ring-[#43acd6]/20'
                                : 'bg-[#f5f5f7] text-[#8e8e93] ring-black/6'
                            }`}
                          >
                            <User size={17} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div
                                  title={sessionUserId}
                                  className="truncate text-sm font-semibold text-[#1d1d1f]"
                                >
                                  {sessionUserId}
                                </div>

                                <p
                                  title={description}
                                  className="mt-1 line-clamp-2 text-xs leading-5 text-[#6e6e73]"
                                >
                                  {description}
                                </p>
                              </div>

                              <div className="shrink-0">
                                {getStatusBadge(session.status)}
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2">
                              <span className="text-xs text-[#8e8e93]">
                                {formatTime(session.created_at)}
                              </span>

                              {timer && (
                                <span
                                  className={`text-xs font-medium ${
                                    timer.warning
                                      ? 'text-amber-600'
                                      : 'text-[#8e8e93]'
                                  }`}
                                >
                                  {timer.text}
                                </span>
                              )}
                            </div>

                            <div className="mt-2 truncate text-xs text-[#8e8e93]">
                              Agent:{' '}
                              <span className="font-medium text-[#6e6e73]">
                                {session.metadata?.assignedAgentName ||
                                  session.agent_id ||
                                  'Unassigned'}
                              </span>
                            </div>

                            {session.status === 'waiting' && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleClaim(session);
                                }}
                                disabled={claiming}
                                className="mt-3 rounded-2xl bg-[#43acd6] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2389b8] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {claiming ? 'Claiming...' : 'Claim'}
                              </button>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <main className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-black/6 bg-white/90 shadow-[0_14px_40px_rgba(0,0,0,0.035)] backdrop-blur">
            {!selectedSession ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-[#eef9fd] text-[#2389b8]">
                    <Headphones size={26} />
                  </div>

                  <h3 className="mt-4 text-lg font-semibold text-[#1d1d1f]">
                    Select a chat session
                  </h3>

                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#6e6e73]">
                    Choose a session from the left panel to view messages and
                    respond to the customer.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-black/6 px-5 py-4">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef9fd] text-[#2389b8]">
                          <User size={16} />
                        </div>

                        <span
                          title={selectedSession.user_id || 'Unknown user'}
                          className="max-w-65 truncate text-sm font-semibold text-[#1d1d1f]"
                        >
                          {selectedSession.user_id || 'Unknown user'}
                        </span>

                        {getStatusBadge(selectedSession.status)}

                        {selectedTimer?.warning && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
                            <AlertTriangle size={12} />
                            Ending soon
                          </span>
                        )}
                      </div>

                      {selectedSession.metadata?.description && (
                        <p
                          title={selectedSession.metadata.description}
                          className="mt-2 max-w-2xl truncate text-xs text-[#6e6e73]"
                        >
                          {selectedSession.metadata.description}
                        </p>
                      )}

                      <p className="mt-1 text-xs text-[#8e8e93]">
                        Agent:{' '}
                        {selectedSession.metadata?.assignedAgentName ||
                          selectedSession.agent_id ||
                          'Unassigned'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {selectedTimer && selectedSession.status === 'active' && (
                        <div
                          className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium ring-1 ${
                            selectedTimer.warning
                              ? 'bg-amber-50 text-amber-700 ring-amber-100'
                              : 'bg-[#f5f5f7] text-[#6e6e73] ring-black/6'
                          }`}
                        >
                          <Timer size={16} />
                          {selectedTimer.text}
                        </div>
                      )}

                      {selectedSession.status === 'waiting' && (
                        <button
                          type="button"
                          onClick={() => handleClaim(selectedSession)}
                          disabled={claiming}
                          className="rounded-2xl bg-[#43acd6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:bg-[#2389b8] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {claiming ? 'Claiming...' : 'Claim Session'}
                        </button>
                      )}

                      {(selectedSession.status === 'active' ||
                        selectedSession.status === 'closed') && (
                        <button
                          type="button"
                          onClick={handleCreateTicket}
                          className="inline-flex items-center gap-2 rounded-2xl border border-[#43acd6]/20 bg-[#eef9fd] px-3 py-2.5 text-sm font-medium text-[#2389b8] transition hover:bg-[#dff3fb]"
                          title="Create a support ticket from this chat session"
                        >
                          <Ticket size={16} />
                          Create Ticket
                        </button>
                      )}

                      {selectedSession.status === 'active' && (
                        <button
                          type="button"
                          onClick={handleClose}
                          disabled={closing}
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <XCircle size={16} />
                          {closing ? 'Ending...' : 'End Session'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {selectedTimer?.warning &&
                  selectedSession.status === 'active' && (
                    <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-700">
                      This chat will end soon if there is no response. A warning
                      message will also be sent to the customer.
                    </div>
                  )}

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#fbfbfd] p-5">
                  {messages.length === 0 ? (
                    <div className="rounded-3xl border border-black/6 bg-white p-6 text-center">
                      <h3 className="font-semibold text-[#1d1d1f]">
                        No messages yet
                      </h3>

                      <p className="mt-1 text-sm text-[#6e6e73]">
                        Messages will appear here in real time.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isAgent = msg.sender_role === 'agent';
                      const isSystem =
                        msg.sender_role === 'system' ||
                        msg.sender_role === 'bot';
                      const isUser = msg.sender_role === 'user';

                      if (isSystem) {
                        return (
                          <div
                            key={msg.id}
                            className="mx-auto max-w-fit rounded-full bg-white px-4 py-2 text-center text-xs text-[#6e6e73] ring-1 ring-black/6"
                          >
                            {msg.content} · {formatTime(msg.created_at)}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${
                            isAgent ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[76%] rounded-[22px] px-4 py-3 shadow-sm ${
                              isAgent
                                ? 'bg-[#43acd6] text-white'
                                : 'bg-white text-[#1d1d1f] ring-1 ring-black/6'
                            }`}
                          >
                            <div className="text-sm leading-6">
                              {msg.attachment_url ? (
                                <>
                                  {msg.content !== '[Image]' && (
                                    <p>{msg.content}</p>
                                  )}

                                  <img
                                    src={msg.attachment_url}
                                    alt="Attachment"
                                    className="mt-2 max-h-52 max-w-full cursor-pointer rounded-2xl border border-black/6 object-cover transition hover:opacity-90"
                                    onClick={() =>
                                      setLightboxUrl(msg.attachment_url)
                                    }
                                  />
                                </>
                              ) : (
                                msg.content
                              )}
                            </div>

                            <div
                              className={`mt-2 text-xs ${
                                isAgent ? 'text-blue-50' : 'text-[#8e8e93]'
                              }`}
                            >
                              {isUser
                                ? 'Customer'
                                : msg.metadata?.agentName || 'Agent'}{' '}
                              · {formatTime(msg.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-black/6 bg-white px-4 py-4">
                  {selectedSession.status === 'closed' ? (
                    <div className="rounded-3xl border border-black/6 bg-[#f5f5f7] p-4 text-center">
                      <div className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#1d1d1f]">
                        <Timer size={16} />
                        Session Ended
                      </div>

                      <p className="mt-1 text-sm text-[#6e6e73]">
                        {selectedSession._closedWhileViewing
                          ? 'This session was closed due to inactivity. The conversation history is preserved above.'
                          : 'This session is closed. You can review the conversation history above.'}
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSession(null);
                          setMessages([]);

                          if (msgSubRef.current) {
                            msgSubRef.current.unsubscribe();
                            msgSubRef.current = null;
                          }
                        }}
                        className="mt-3 rounded-2xl border border-black/8 bg-white px-4 py-2 text-sm font-medium text-[#6e6e73] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : selectedSession.status === 'waiting' ? (
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-center">
                      <p className="text-sm font-medium text-amber-700">
                        This session is waiting for an agent.
                      </p>

                      <p className="mt-1 text-xs text-amber-600">
                        It should auto-assign when an agent is available. You can
                        also claim it manually.
                      </p>
                    </div>
                  ) : selectedSession.status === 'active' ? (
                    <form
                      onSubmit={handleSend}
                      className="flex items-end gap-3 rounded-3xl border border-black/6 bg-[#f5f5f7] p-3"
                    >
                      <textarea
                        rows="2"
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            handleSend(event);
                          }
                        }}
                        placeholder="Type your reply to customer..."
                        className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1 text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
                      />

                      <button
                        type="submit"
                        disabled={sending || !input.trim()}
                        className="rounded-2xl bg-[#43acd6] p-3 text-white shadow-[0_14px_28px_rgba(67,172,214,0.20)] transition hover:bg-[#2389b8] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sending ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Send size={18} />
                        )}
                      </button>
                    </form>
                  ) : (
                    <div className="rounded-3xl border border-black/6 bg-[#f5f5f7] p-4 text-center text-sm text-[#6e6e73]">
                      This session is closed.
                    </div>
                  )}
                </div>
              </>
            )}
          </main>
        </section>
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Full size attachment"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain"
          />
        </div>
      )}
    </DashboardLayout>
  );
};

const StatusPill = ({ label, value, tone }) => {
  const tones = {
    red: 'bg-red-50 text-red-700 ring-red-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    blue: 'bg-[#eef9fd] text-[#2389b8] ring-[#43acd6]/15',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${tones[tone]}`}
    >
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
};

const getLatestCustomerMessage = (messages) => {
  const latestCustomerMessage = [...messages]
    .reverse()
    .find((message) => message.sender_role === 'user');

  return latestCustomerMessage?.content || '';
};

export default LiveChatPage;