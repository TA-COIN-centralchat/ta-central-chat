import { useEffect, useState, useRef, useCallback } from 'react';
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
  Image as ImageIcon,
  Timer,
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { supabase } from '../services/supabaseClient';
import {
  getActiveSessions,
  getSessionMessages,
  sendMessage,
  claimSession,
  closeSession,
  subscribeToAllSessions,
  subscribeToSessionMessages,
} from '../services/realtimeChat';

const LiveChatPage = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const msgSubRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Use the logged-in agent info (hardcoded for now, same pattern as ticketService)
  const agentId = 'agent_dashboard';
  const agentName = 'Agent Dara';

  // ─── Load sessions on mount + subscribe to realtime changes ───
  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoading(true);
        const data = await getActiveSessions();
        setSessions(data);
      } catch (err) {
        console.error('Failed to load chat sessions:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();

    // Subscribe to all session changes in real time
    const sub = subscribeToAllSessions((eventType, newSession, oldSession) => {
      setSessions((prev) => {
        if (eventType === 'INSERT') {
          // Only add if not already present and status is waiting/active
          if (prev.some((s) => s.id === newSession.id)) return prev;
          if (newSession.status === 'closed') return prev;
          return [...prev, newSession];
        }
        if (eventType === 'UPDATE') {
          if (newSession.status === 'closed') {
            // Remove closed sessions from the active list
            return prev.filter((s) => s.id !== newSession.id);
          }
          return prev.map((s) => (s.id === newSession.id ? newSession : s));
        }
        if (eventType === 'DELETE') {
          return prev.filter((s) => s.id !== (oldSession?.id || newSession?.id));
        }
        return prev;
      });

      // If the currently selected session was updated, refresh it
      if (eventType === 'UPDATE' && newSession) {
        setSelectedSession((prev) => {
          if (prev && prev.id === newSession.id) {
            if (newSession.status === 'closed') {
              // Keep the session visible but mark it as closed
              // so the agent can see the timeout message and chat history
              return { ...newSession, _closedWhileViewing: true };
            }
            return newSession;
          }
          return prev;
        });
      }
    });

    return () => {
      sub.unsubscribe();
    };
  }, []);

  // ─── Auto-scroll messages ───
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Select a session: load messages + subscribe ───
  const selectSession = useCallback(async (session) => {
    // Unsubscribe from previous session messages
    if (msgSubRef.current) {
      msgSubRef.current.unsubscribe();
      msgSubRef.current = null;
    }

    setSelectedSession(session);
    setMessages([]);

    try {
      const msgs = await getSessionMessages(session.id);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load session messages:', err);
    }

    // Subscribe to new messages in real time
    msgSubRef.current = subscribeToSessionMessages(session.id, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
  }, []);

  // ─── Claim a waiting session ───
  const handleClaim = async (session) => {
    try {
      setClaiming(true);
      const claimed = await claimSession(session.id, agentId);
      setSelectedSession(claimed);

      // Send system message
      await sendMessage(
        session.id,
        'system',
        agentId,
        `${agentName} has joined the chat.`,
        { agentName }
      );

      // Load messages for the claimed session
      const msgs = await getSessionMessages(session.id);
      setMessages(msgs);

      // Subscribe to messages
      if (msgSubRef.current) msgSubRef.current.unsubscribe();
      msgSubRef.current = subscribeToSessionMessages(session.id, (msg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
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

  // ─── Send a reply ───
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedSession || sending) return;

    const text = input.trim();
    setInput('');

    try {
      setSending(true);
      await sendMessage(selectedSession.id, 'agent', agentId, text, { agentName });
    } catch (err) {
      console.error('Failed to send message:', err);
      setInput(text); // Restore input on failure
    } finally {
      setSending(false);
    }
  };

  // ─── Close session + auto-create ticket via Edge Function ───
  const handleClose = async () => {
    if (!selectedSession) return;

    const confirmed = window.confirm(
      'Close this chat session and auto-create a support ticket?'
    );
    if (!confirmed) return;

    try {
      await sendMessage(
        selectedSession.id,
        'system',
        agentId,
        'Session closed by agent.',
        { agentName }
      );
      await closeSession(selectedSession.id);

      // Call the Edge Function to auto-create a ticket from this session
      try {
        const { data, error } = await supabase.functions.invoke('chat-to-ticket', {
          body: { session_id: selectedSession.id },
        });
        if (error) {
          console.warn('Edge function chat-to-ticket failed:', error);
        } else if (data?.ticket_number) {
          console.log(`Ticket ${data.ticket_number} created from chat session.`);
        }
      } catch (edgeFnErr) {
        // Edge function may not be deployed yet — this is non-blocking
        console.warn('chat-to-ticket edge function not available:', edgeFnErr);
      }

      // Clean up
      if (msgSubRef.current) {
        msgSubRef.current.unsubscribe();
        msgSubRef.current = null;
      }
      setSelectedSession(null);
      setMessages([]);
    } catch (err) {
      console.error('Failed to close session:', err);
    }
  };

  // ─── Manually create ticket from active session ───
  const handleCreateTicket = async () => {
    if (!selectedSession) return;

    try {
      const { data, error } = await supabase.functions.invoke('chat-to-ticket', {
        body: { session_id: selectedSession.id, force: true },
      });

      if (error) {
        alert('Failed to create ticket. The edge function may not be deployed yet.');
        console.error('Edge function error:', error);
        return;
      }

      if (data?.ticket_number) {
        alert(`Ticket ${data.ticket_number} created successfully!`);
      }
    } catch (err) {
      console.warn('chat-to-ticket edge function not available:', err);
      alert('The chat-to-ticket edge function is not deployed yet. Deploy it first with: supabase functions deploy chat-to-ticket');
    }
  };

  // ─── Helpers ───
  const formatTime = (dateStr) => {
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
          Timed Out
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        {status}
      </span>
    );
  };

  const waitingCount = sessions.filter((s) => s.status === 'waiting').length;
  const activeCount = sessions.filter((s) => s.status === 'active').length;

  return (
    <DashboardLayout
      title="Live Chat"
      description="Real-time chat sessions from the website chatbot. Claim waiting sessions and respond to customers live."
    >
      {/* Stats bar */}
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

      <div className="grid h-[calc(100vh-230px)] grid-cols-[340px_1fr] gap-4">
        {/* ─── Session List (Left Panel) ─── */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Chat Sessions
            </h3>
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

                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => selectSession(session)}
                      className={`w-full p-4 text-left transition hover:bg-slate-50 ${
                        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <User size={14} className="shrink-0 text-slate-400" />
                            <span className="truncate text-sm font-medium text-slate-900">
                              {session.user_id.length > 20
                                ? session.user_id.slice(0, 20) + '...'
                                : session.user_id}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {description.length > 60
                              ? description.slice(0, 60) + '...'
                              : description}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {getStatusBadge(session.status)}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          {formatTime(session.created_at)}
                        </span>
                        {session.status === 'waiting' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClaim(session);
                            }}
                            disabled={claiming}
                            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {claiming ? 'Claiming...' : 'Claim'}
                          </button>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── Chat Window (Right Panel) ─── */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white">
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
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b border-slate-200 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-slate-500" />
                    <span className="text-sm font-semibold text-slate-900">
                      {selectedSession.user_id.length > 24
                        ? selectedSession.user_id.slice(0, 24) + '...'
                        : selectedSession.user_id}
                    </span>
                    {getStatusBadge(selectedSession.status)}
                  </div>
                  {selectedSession.metadata?.description && (
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedSession.metadata.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
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
                  {selectedSession.status === 'active' && (
                    <>
                      <button
                        type="button"
                        onClick={handleCreateTicket}
                        className="flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        title="Create a support ticket from this chat session"
                      >
                        <Ticket size={16} />
                        Create Ticket
                      </button>
                      <button
                        type="button"
                        onClick={handleClose}
                        className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                      >
                        <XCircle size={16} />
                        Close Session
                      </button>
                    </>
                  )}
                  {selectedSession.status === 'closed' && (
                    <button
                      type="button"
                      onClick={handleCreateTicket}
                      className="flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                      title="Create a support ticket from this timed-out chat session"
                    >
                      <Ticket size={16} />
                      Create Ticket
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
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
                        className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}
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
                                {msg.content !== '[Image]' && <p>{msg.content}</p>}
                                <img
                                  src={msg.attachment_url}
                                  alt="Attachment"
                                  className="mt-2 max-h-52 max-w-full cursor-pointer rounded-xl border border-slate-200 object-cover transition hover:opacity-90"
                                  onClick={() => setLightboxUrl(msg.attachment_url)}
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
                            {isUser ? 'Customer' : msg.metadata?.agentName || 'Agent'}{' '}
                            · {formatTime(msg.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-slate-200 p-4">
                {selectedSession.status === 'closed' ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <div className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-700">
                      <Timer size={16} />
                      Session Closed
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedSession._closedWhileViewing
                        ? 'This session was closed due to user inactivity. The conversation history is preserved above.'
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
                      Claim this session to start chatting
                    </p>
                    <p className="mt-1 text-xs text-amber-600">
                      The customer is waiting for an agent to respond.
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
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend(e);
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

      {/* Image Lightbox Overlay */}
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

export default LiveChatPage;
