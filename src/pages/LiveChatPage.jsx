import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Headphones,
  MessageSquare,
  Clock,
  CheckCircle,
  Send,
  User,
  XCircle,
  Radio,
  Ticket,
  Timer,
  AlertTriangle,
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
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
          <Clock size={12} />
          Waiting
        </span>
      );
    }

    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <CheckCircle size={12} />
          Active
        </span>
      );
    }

    if (status === 'closed') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
          <Timer size={12} />
          Ended
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
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

  const waitingCount = sessions.filter(
    (session) => session.status === 'waiting'
  ).length;

  const activeCount = sessions.filter(
    (session) => session.status === 'active'
  ).length;

  const selectedTimer = getSessionTimerLabel(selectedSession);

  return (
    <DashboardLayout
      title="Live Chat"
      description="Real-time chat sessions from the website chatbot. Sessions are auto-assigned when agents are available. Create tickets only when the customer has a real issue."
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
          <Radio size={16} className="animate-pulse" />
          {waitingCount} Waiting
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
          <Headphones size={16} />
          {activeCount} Active
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">
          <MessageSquare size={16} />
          {sessions.length} Total Sessions
        </div>
      </div>

      <div className="grid h-[calc(100vh-230px)] grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
        <div className="flex min-h-105 flex-col rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Chat Sessions
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Active sessions are auto-assigned. Waiting sessions appear only
              when all agents are busy or unavailable.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Loading sessions...
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-6 text-center">
                <MessageSquare
                  size={32}
                  className="mx-auto mb-2 text-slate-300"
                />

                <p className="text-sm font-medium text-slate-600">
                  No active sessions
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  New chat sessions from the website will appear here in real
                  time.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sessions.map((session) => {
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
                      className={`w-full p-4 text-left transition hover:bg-slate-50 ${
                        isSelected
                          ? 'border-l-4 border-l-blue-600 bg-blue-50'
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <User
                              size={14}
                              className="shrink-0 text-slate-400"
                            />

                            <span className="truncate text-sm font-medium text-slate-900">
                              {sessionUserId.length > 20
                                ? `${sessionUserId.slice(0, 20)}...`
                                : sessionUserId}
                            </span>
                          </div>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {description.length > 60
                              ? `${description.slice(0, 60)}...`
                              : description}
                          </p>
                        </div>

                        <div className="shrink-0">
                          {getStatusBadge(session.status)}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-400">
                          {formatTime(session.created_at)}
                        </span>

                        {timer && (
                          <span
                            className={`text-xs font-medium ${
                              timer.warning
                                ? 'text-amber-600'
                                : 'text-slate-400'
                            }`}
                          >
                            {timer.text}
                          </span>
                        )}

                        {session.status === 'waiting' && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleClaim(session);
                            }}
                            disabled={claiming}
                            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {claiming ? 'Claiming...' : 'Claim'}
                          </button>
                        )}
                      </div>

                      <div className="mt-2 text-xs text-slate-400">
                        Agent:{' '}
                        <span className="font-medium text-slate-500">
                          {session.metadata?.assignedAgentName ||
                            session.agent_id ||
                            'Unassigned'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-105 flex-col rounded-2xl border border-slate-200 bg-white">
          {!selectedSession ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <Headphones
                  size={40}
                  className="mx-auto mb-3 text-slate-300"
                />

                <h3 className="text-lg font-semibold text-slate-900">
                  Select a chat session
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Choose a session from the left panel to start chatting.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <User size={16} className="text-slate-500" />

                    <span className="text-sm font-semibold text-slate-900">
                      {(selectedSession.user_id || 'Unknown user').length > 24
                        ? `${(selectedSession.user_id || 'Unknown user').slice(
                            0,
                            24
                          )}...`
                        : selectedSession.user_id || 'Unknown user'}
                    </span>

                    {getStatusBadge(selectedSession.status)}

                    {selectedTimer?.warning && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        <AlertTriangle size={12} />
                        Ending soon
                      </span>
                    )}
                  </div>

                  {selectedSession.metadata?.description && (
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedSession.metadata.description}
                    </p>
                  )}

                  <p className="mt-1 text-xs text-slate-400">
                    Agent:{' '}
                    {selectedSession.metadata?.assignedAgentName ||
                      selectedSession.agent_id ||
                      'Unassigned'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedTimer && selectedSession.status === 'active' && (
                    <div
                      className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                        selectedTimer.warning
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
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
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {claiming ? 'Claiming...' : 'Claim Session'}
                    </button>
                  )}

                  {(selectedSession.status === 'active' ||
                    selectedSession.status === 'closed') && (
                    <button
                      type="button"
                      onClick={handleCreateTicket}
                      className="flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
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
                      className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      <XCircle size={16} />
                      {closing ? 'Ending...' : 'End Session'}
                    </button>
                  )}
                </div>
              </div>

              {selectedTimer?.warning && selectedSession.status === 'active' && (
                <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-700">
                  This chat will end soon if there is no response. A warning
                  message will also be sent to the customer.
                </div>
              )}

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {messages.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-6 text-center">
                    <h3 className="font-semibold text-slate-900">
                      No messages yet
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Messages will appear here in real time.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isAgent = msg.sender_role === 'agent';
                    const isSystem =
                      msg.sender_role === 'system' || msg.sender_role === 'bot';
                    const isUser = msg.sender_role === 'user';

                    if (isSystem) {
                      return (
                        <div
                          key={msg.id}
                          className="rounded-full bg-slate-100 px-4 py-2 text-center text-xs text-slate-500"
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
                          className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                            isAgent
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-900'
                          }`}
                        >
                          <div className="text-sm leading-relaxed">
                            {msg.attachment_url ? (
                              <>
                                {msg.content !== '[Image]' && (
                                  <p>{msg.content}</p>
                                )}

                                <img
                                  src={msg.attachment_url}
                                  alt="Attachment"
                                  className="mt-2 max-h-52 max-w-full cursor-pointer rounded-xl border border-slate-200 object-cover transition hover:opacity-90"
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
                              isAgent ? 'text-blue-100' : 'text-slate-400'
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

              <div className="border-t border-slate-200 p-4">
                {selectedSession.status === 'closed' ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <div className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-700">
                      <Timer size={16} />
                      Session Ended
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
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
                      className="mt-3 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : selectedSession.status === 'waiting' ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
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
                    className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"
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
                      className="flex-1 resize-none bg-transparent text-sm outline-none"
                    />

                    <button
                      type="submit"
                      disabled={sending || !input.trim()}
                      className="rounded-xl bg-blue-600 p-3 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send size={18} />
                    </button>
                  </form>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                    This session is closed.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Full size attachment"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
        </div>
      )}
    </DashboardLayout>
  );
};

const getLatestCustomerMessage = (messages) => {
  const latestCustomerMessage = [...messages]
    .reverse()
    .find((message) => message.sender_role === 'user');

  return latestCustomerMessage?.content || '';
};

export default LiveChatPage;