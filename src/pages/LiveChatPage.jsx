import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  ArrowLeft,
  Phone,
  Mail,
  AtSign,
  Hash,
  Globe,
  MessageCircle,
  ChevronRight,
  Shield,
  Zap,
} from "lucide-react";

import {
  getActiveSessions,
  getSessionMessages,
  sendMessage,
  closeSession,
  processChatSessionTimeouts,
  subscribeToAllSessions,
  subscribeToSessionMessages,
} from "../services/realtimeChat";
import { useLayout } from "../context/LayoutContext";

const LiveChatPage = () => {
  const { setTitle, setDescription } = useLayout();

  useEffect(() => {
    setTitle("Live Chat");
    setDescription("Real-time chat sessions from the website chatbot. Sessions are auto-assigned when agents are available. Create tickets only when the customer has a real issue.");
  }, [setTitle, setDescription]);

  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [viewMode, setViewMode] = useState("cards"); // 'cards' | 'chat'

  const msgSubRef = useRef(null);
  const messagesEndRef = useRef(null);

  const agentId =
    localStorage.getItem("currentAgentId") ||
    localStorage.getItem("tacoin_agent_id") ||
    "agent_dashboard";

  const agentName = localStorage.getItem("currentUserName") || "Agent";

  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoading(true);

        const data = await getActiveSessions();
        setSessions(data || []);
      } catch (err) {
        console.error("Failed to load chat sessions:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();

    const sub = subscribeToAllSessions((eventType, newSession, oldSession) => {
      setSessions((prev) => {
        if (eventType === "INSERT") {
          if (prev.some((session) => session.id === newSession.id)) {
            return prev;
          }

          if (newSession.status === "closed") {
            return prev;
          }

          return [...prev, newSession];
        }

        if (eventType === "UPDATE") {
          if (newSession.status === "closed") {
            return prev.filter((session) => session.id !== newSession.id);
          }

          return prev.map((session) =>
            session.id === newSession.id ? newSession : session,
          );
        }

        if (eventType === "DELETE") {
          return prev.filter(
            (session) => session.id !== (oldSession?.id || newSession?.id),
          );
        }

        return prev;
      });

      if (eventType === "UPDATE" && newSession) {
        setSelectedSession((prev) => {
          if (!prev || prev.id !== newSession.id) {
            return prev;
          }

          if (newSession.status === "closed") {
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
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (msgSubRef.current) {
        msgSubRef.current.unsubscribe();
        msgSubRef.current = null;
      }
    };
  }, []);

  const selectSession = useCallback((session) => {
    setSelectedSession(session);
  }, []);

  const openChat = useCallback(async (session) => {
    if (msgSubRef.current) {
      msgSubRef.current.unsubscribe();
      msgSubRef.current = null;
    }

    setSelectedSession(session);
    setMessages([]);
    setViewMode("chat");

    try {
      const msgs = await getSessionMessages(session.id);
      setMessages(msgs || []);
    } catch (err) {
      console.error("Failed to load session messages:", err);
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

  const backToCards = useCallback(() => {
    if (msgSubRef.current) {
      msgSubRef.current.unsubscribe();
      msgSubRef.current = null;
    }

    setViewMode("cards");
    setMessages([]);
  }, []);

  const handleSend = async (event) => {
    event.preventDefault();

    if (!input.trim() || !selectedSession || sending) {
      return;
    }

    const text = input.trim();
    setInput("");

    try {
      setSending(true);

      await sendMessage(selectedSession.id, "agent", agentId, text, {
        agentName,
      });
    } catch (err) {
      console.error("Failed to send message:", err);
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
      "End this chat session? This will not create a ticket automatically. Create a ticket first if the customer has a real issue.",
    );

    if (!confirmed) {
      return;
    }

    try {
      setClosing(true);

      await sendMessage(
        selectedSession.id,
        "system",
        agentId,
        "Session ended by agent.",
        { agentName },
      );

      await closeSession(selectedSession.id);

      if (msgSubRef.current) {
        msgSubRef.current.unsubscribe();
        msgSubRef.current = null;
      }

      setSelectedSession(null);
      setMessages([]);
      setViewMode("cards");
    } catch (err) {
      console.error("Failed to close session:", err);
      alert("Failed to close session. Please try again.");
    } finally {
      setClosing(false);
    }
  };

  const handleCreateTicket = () => {
    if (!selectedSession) {
      return;
    }

    const latestCustomerMessage = getLatestCustomerMessage(messages);

    navigate("/manual-ticket", {
      state: {
        fromSession: true,
        from: "/live-chat",
        fromLabel: "Live Chat",

        sessionId: selectedSession.id,
        sessionNumber: selectedSession.id,

        customerName:
          selectedSession.metadata?.customerName ||
          selectedSession.metadata?.name ||
          selectedSession.user_id ||
          "Unknown Customer",

        phone: selectedSession.metadata?.phone || "",

        telegram:
          selectedSession.metadata?.telegram ||
          selectedSession.metadata?.telegram_username ||
          "",

        email: selectedSession.metadata?.email || "",

        accountId:
          selectedSession.metadata?.accountId ||
          selectedSession.metadata?.ta_coin_user_id ||
          "",

        channel: "Website Chatbot",

        issueDescription:
          latestCustomerMessage ||
          selectedSession.metadata?.description ||
          "Created from live chat session.",

        internalNote: `Created from live chat session: ${selectedSession.id}`,
      },
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) {
      return "-";
    }

    return new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) {
      return "-";
    }

    return new Date(dateStr).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status) => {
    if (status === "waiting") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
          <Clock size={12} />
          Waiting
        </span>
      );
    }

    if (status === "active") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <CheckCircle size={12} />
          Active
        </span>
      );
    }

    if (status === "closed") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
          <Timer size={12} />
          Ended
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        {status || "Unknown"}
      </span>
    );
  };

  const getSessionTimerLabel = (session) => {
    const expiresAt = session?.metadata?.expiresAt;

    if (!expiresAt || session.status !== "active") {
      return null;
    }

    const remainingMs = new Date(expiresAt).getTime() - currentTime;

    if (remainingMs <= 0) {
      return {
        text: "Expired",
        warning: true,
      };
    }

    const remainingMinutes = Math.ceil(remainingMs / 60000);

    return {
      text: `${remainingMinutes} min left`,
      warning: remainingMinutes <= 2,
    };
  };

  const getCustomerName = (session) => {
    return (
      session.metadata?.customerName ||
      session.metadata?.name ||
      session.user_id ||
      "Unknown Customer"
    );
  };

  const waitingCount = sessions.filter(
    (session) => session.status === "waiting",
  ).length;

  const activeCount = sessions.filter(
    (session) => session.status === "active",
  ).length;

  const selectedTimer = getSessionTimerLabel(selectedSession);

  // ─── Chat View ────────────────────────────────────────────────────
  if (viewMode === "chat" && selectedSession) {
    return (
      <>
        <div className="grid h-[calc(100vh-230px)] grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
          {/* Chat Panel */}
          <div className="flex min-h-105 flex-col rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={backToCards}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
                  title="Back to sessions"
                >
                  <ArrowLeft size={18} />
                </button>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {getCustomerName(selectedSession).length > 24
                        ? `${getCustomerName(selectedSession).slice(0, 24)}...`
                        : getCustomerName(selectedSession)}
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
                    Agent:{" "}
                    {selectedSession.metadata?.assignedAgentName ||
                      selectedSession.agent_id ||
                      "Unassigned"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedTimer && selectedSession.status === "active" && (
                  <div
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                      selectedTimer.warning
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    <Timer size={16} />
                    {selectedTimer.text}
                  </div>
                )}

                {(selectedSession.status === "active" ||
                  selectedSession.status === "closed") && (
                  <button
                    type="button"
                    onClick={handleCreateTicket}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                    title="Create a support ticket from this chat session"
                  >
                    <Ticket size={16} />
                    Create Ticket
                  </button>
                )}

                {selectedSession.status === "active" && (
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={closing}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
                  >
                    <XCircle size={16} />
                    {closing ? "Ending..." : "End Session"}
                  </button>
                )}
              </div>
            </div>

            {selectedTimer?.warning && selectedSession.status === "active" && (
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
                  const isAgent = msg.sender_role === "agent";
                  const isSystem =
                    msg.sender_role === "system" || msg.sender_role === "bot";
                  const isUser = msg.sender_role === "user";

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
                        isAgent ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                          isAgent
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-900"
                        }`}
                      >
                        <div className="text-sm leading-relaxed">
                          {msg.attachment_url ? (
                            <>
                              {msg.content !== "[Image]" && (
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
                            isAgent ? "text-blue-100" : "text-slate-400"
                          }`}
                        >
                          {isUser
                            ? "Customer"
                            : msg.metadata?.agentName || "Agent"}{" "}
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
              {selectedSession.status === "closed" ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-700">
                    <Timer size={16} />
                    Session Ended
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {selectedSession._closedWhileViewing
                      ? "This session was closed due to inactivity. The conversation history is preserved above."
                      : "This session is closed. You can review the conversation history above."}
                  </p>

                  <button
                    type="button"
                    onClick={backToCards}
                    className="mt-3 rounded-xl border border-slate-200 h-10 px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Back to Sessions
                  </button>
                </div>
              ) : selectedSession.status === "waiting" ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                  <p className="text-sm font-medium text-amber-700">
                    This session is waiting for an agent.
                  </p>

                  <p className="mt-1 text-xs text-amber-600">
                    It will auto-assign when an agent is available.
                  </p>
                </div>
              ) : selectedSession.status === "active" ? (
                <form
                  onSubmit={handleSend}
                  className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"
                >
                  <textarea
                    rows="2"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
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
          </div>

          {/* Right: Customer Info Panel in Chat View */}
          <CustomerInfoPanel
            session={selectedSession}
            timer={selectedTimer}
            formatDate={formatDate}
            formatTime={formatTime}
            getStatusBadge={getStatusBadge}
            getCustomerName={getCustomerName}
          />
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
      </>
    );
  }

  // ─── Cards View (Default) ─────────────────────────────────────────
  return (
    <>
      {/* Stats Bar */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 h-10 px-4 text-sm font-medium text-amber-700">
          <Radio size={16} className="animate-pulse" />
          {waitingCount} Waiting
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 h-10 px-4 text-sm font-medium text-emerald-700">
          <Headphones size={16} />
          {activeCount} Active
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white h-10 px-4 text-sm font-medium text-slate-600">
          <MessageSquare size={16} />
          {sessions.length} Total Sessions
        </div>
      </div>

      <div className="grid h-[calc(100vh-230px)] grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        {/* Left: Session Cards */}
        <div className="flex min-h-105 flex-col rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Chat Sessions
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Click on a session card to view customer details. Use "Open Chat"
              to start chatting.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Loading sessions...
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                  <MessageSquare size={28} className="text-slate-300" />
                </div>

                <p className="text-sm font-medium text-slate-600">
                  No active sessions
                </p>

                <p className="mt-1 max-w-xs text-center text-xs text-slate-400">
                  New chat sessions from the website will appear here in real
                  time.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {sessions.map((session) => {
                  const isSelected = selectedSession?.id === session.id;
                  const description =
                    session.metadata?.description || "No description";
                  const customerName = getCustomerName(session);
                  const timer = getSessionTimerLabel(session);
                  const assignedAgent =
                    session.metadata?.assignedAgentName ||
                    session.agent_id ||
                    "Unassigned";
                  const phone = session.metadata?.phone || "";
                  const email = session.metadata?.email || "";
                  const channel =
                    session.metadata?.channel || "Website Chatbot";

                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => selectSession(session)}
                      className={`group relative w-full rounded-2xl border p-4 text-left transition-all duration-200 hover:shadow-md ${
                        isSelected
                          ? "border-blue-300 bg-blue-50/60 shadow-sm ring-1 ring-blue-200"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      {/* Status accent bar */}
                      <div
                        className={`absolute left-0 top-4 h-8 w-1 rounded-r-full transition-all ${
                          session.status === "active"
                            ? "bg-emerald-500"
                            : session.status === "waiting"
                              ? "bg-amber-400"
                              : "bg-slate-300"
                        }`}
                      />

                      {/* Header: Name + Status */}
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                              session.status === "active"
                                ? "bg-emerald-100 text-emerald-700"
                                : session.status === "waiting"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {customerName.charAt(0).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {customerName.length > 20
                                ? `${customerName.slice(0, 20)}...`
                                : customerName}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-400">
                              {formatTime(session.created_at)}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {getStatusBadge(session.status)}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="mb-3 text-xs leading-relaxed text-slate-500">
                        {description.length > 80
                          ? `${description.slice(0, 80)}...`
                          : description}
                      </p>

                      {/* Info Grid */}
                      <div className="mb-3 grid grid-cols-2 gap-2">
                        {phone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Phone size={11} className="shrink-0" />
                            <span className="truncate">{phone}</span>
                          </div>
                        )}

                        {email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Mail size={11} className="shrink-0" />
                            <span className="truncate">{email}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Globe size={11} className="shrink-0" />
                          <span className="truncate">{channel}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Shield size={11} className="shrink-0" />
                          <span className="truncate">{assignedAgent}</span>
                        </div>
                      </div>

                      {/* Footer: Timer + Open Chat */}
                      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                        {timer ? (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              timer.warning
                                ? "text-amber-600"
                                : "text-slate-400"
                            }`}
                          >
                            <Timer size={12} />
                            {timer.text}
                          </span>
                        ) : (
                          <span />
                        )}

                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            openChat(session);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                        >
                          <MessageCircle size={12} />
                          Open Chat
                          <ChevronRight size={12} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Customer Info Panel */}
        {selectedSession ? (
          <CustomerInfoPanel
            session={selectedSession}
            timer={selectedTimer}
            formatDate={formatDate}
            formatTime={formatTime}
            getStatusBadge={getStatusBadge}
            getCustomerName={getCustomerName}
            onOpenChat={() => openChat(selectedSession)}
            onCreateTicket={handleCreateTicket}
            onEndSession={handleClose}
            closing={closing}
            showActions
          />
        ) : (
          <div className="flex min-h-105 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <User size={28} className="text-slate-300" />
              </div>

              <h3 className="text-lg font-semibold text-slate-900">
                Customer Details
              </h3>

              <p className="mt-1 max-w-xs text-sm text-slate-500">
                Select a session card to view the full customer information
                here.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ─── Customer Info Panel Component ────────────────────────────────

const CustomerInfoPanel = ({
  session,
  timer,
  formatDate,
  formatTime,
  getStatusBadge,
  getCustomerName,
  onOpenChat,
  onCreateTicket,
  onEndSession,
  closing,
  showActions,
}) => {
  const customerName = getCustomerName(session);
  const phone = session.metadata?.phone || "";
  const email = session.metadata?.email || "";
  const telegram =
    session.metadata?.telegram || session.metadata?.telegram_username || "";
  const accountId =
    session.metadata?.accountId || session.metadata?.ta_coin_user_id || "";
  const channel = session.metadata?.channel || "Website Chatbot";
  const assignedAgent =
    session.metadata?.assignedAgentName || session.agent_id || "Unassigned";
  const description = session.metadata?.description || "No description";
  const autoAssigned = session.metadata?.autoAssigned;

  return (
    <div className="flex max-h-[calc(100vh-230px)] min-h-105 flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white">
      {/* Customer Header */}
      <div className="border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-lg font-bold text-white shadow-sm">
            {customerName.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900">
              {customerName}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              {getStatusBadge(session.status)}
              {autoAssigned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                  <Zap size={10} />
                  Auto
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Contact Info */}
      <div className="border-b border-slate-100 p-5">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Contact Information
        </h4>

        <div className="space-y-3">
          <InfoRow
            icon={<User size={14} />}
            label="Full Name"
            value={customerName}
          />

          <InfoRow
            icon={<Phone size={14} />}
            label="Phone"
            value={phone || "Not provided"}
            muted={!phone}
          />

          <InfoRow
            icon={<Mail size={14} />}
            label="Email"
            value={email || "Not provided"}
            muted={!email}
          />

          <InfoRow
            icon={<AtSign size={14} />}
            label="Telegram"
            value={telegram || "Not provided"}
            muted={!telegram}
          />

          <InfoRow
            icon={<Hash size={14} />}
            label="T.A Coin User ID"
            value={accountId || "Not provided"}
            muted={!accountId}
          />
        </div>
      </div>

      {/* Session Details */}
      <div className="border-b border-slate-100 p-5">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Session Details
        </h4>

        <div className="space-y-3">
          <InfoRow
            icon={<Hash size={14} />}
            label="Session ID"
            value={
              session.id?.length > 18
                ? `${session.id.slice(0, 18)}...`
                : session.id
            }
            mono
          />

          <InfoRow icon={<Globe size={14} />} label="Channel" value={channel} />

          <InfoRow
            icon={<Shield size={14} />}
            label="Assigned Agent"
            value={assignedAgent}
          />

          <InfoRow
            icon={<Clock size={14} />}
            label="Started"
            value={formatDate(session.created_at)}
          />

          {timer && (
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                <Timer size={14} />
              </div>

              <div>
                <div className="text-xs text-slate-400">Time Remaining</div>
                <div
                  className={`text-sm font-medium ${
                    timer.warning ? "text-amber-600" : "text-slate-800"
                  }`}
                >
                  {timer.text}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="border-b border-slate-100 p-5">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Description
        </h4>

        <p className="text-sm leading-relaxed text-slate-600">{description}</p>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="p-5">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onOpenChat}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 h-10 px-4.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <MessageCircle size={16} />
              Open Chat
            </button>

            {(session.status === "active" || session.status === "closed") &&
              onCreateTicket && (
                <button
                  type="button"
                  onClick={onCreateTicket}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 h-10 px-4.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                >
                  <Ticket size={16} />
                  Create Ticket
                </button>
              )}

            {session.status === "active" && onEndSession && (
              <button
                type="button"
                onClick={onEndSession}
                disabled={closing}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 h-10 px-4.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
              >
                <XCircle size={16} />
                {closing ? "Ending..." : "End Session"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Info Row Component ───────────────────────────────────────────

const InfoRow = ({ icon, label, value, muted, mono }) => (
  <div className="flex items-center gap-2.5">
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
      {icon}
    </div>

    <div className="min-w-0">
      <div className="text-xs text-slate-400">{label}</div>
      <div
        className={`truncate text-sm ${
          muted
            ? "text-slate-400 italic"
            : mono
              ? "font-mono text-slate-700"
              : "font-medium text-slate-800"
        }`}
      >
        {value}
      </div>
    </div>
  </div>
);

// ─── Utility ──────────────────────────────────────────────────────

const getLatestCustomerMessage = (messages) => {
  const latestCustomerMessage = [...messages]
    .reverse()
    .find((message) => message.sender_role === "user");

  return latestCustomerMessage?.content || "";
};

export default LiveChatPage;
