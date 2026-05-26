import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  MessageCircle,
  SendHorizontal,
  ShieldCheck,
  Star,
  Ticket,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useLayout } from "../context/LayoutContext";
import {
  assignSessionToCurrentAgent,
  endSession,
  getSessionById,
  sendSessionReply,
} from "../services/sessionService";

const SessionWorkspacePage = () => {
  const { setTitle, setDescription } = useLayout();

  useEffect(() => {
    setTitle("Session Workspace");
    setDescription("Chat with the customer, then raise a ticket only when a real issue needs tracking.");
  }, [setTitle, setDescription]);

  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const chatEndRef = useRef(null);

  const fromPath = location.state?.from || "/telegram";
  const fromLabel = location.state?.fromLabel || "Channel Sessions";

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [localReplies, setLocalReplies] = useState([]);

  const loadSession = async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const data = await getSessionById(sessionId);
      setSession(data);
    } catch (error) {
      console.error("Failed to load session workspace:", error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localReplies, session?.lastMessage]);

  const handleEndSession = async () => {
    if (!session?.dbId) return;

    const confirmed = window.confirm(
      "End this customer conversation session? The linked ticket can still continue internally.",
    );

    if (!confirmed) return;

    try {
      setEnding(true);
      await endSession(session.dbId);
      await loadSession({ showLoading: false });
    } catch (error) {
      console.error("Failed to end session:", error);
      alert("Failed to end session. Please check console.");
    } finally {
      setEnding(false);
    }
  };

  const handleRaiseTicket = () => {
    navigate("/manual-ticket", {
      state: {
        fromSessionId: session.dbId,
        fromSessionNumber: session.id,
        customerName: session.customer,
        phone: session.phone,
        telegram: session.telegram,
        email: session.email,
        accountId: session.accountId,
        channel: session.channel,
      },
    });
  };

  const handleSendReply = async () => {
    if (!session?.dbId) return;

    if (!replyText.trim()) {
      alert("Please enter a reply.");
      return;
    }

    const messageText = replyText.trim();

    try {
      setSendingReply(true);

      await sendSessionReply({
        sessionId: session.dbId,
        messageText,
      });

      setLocalReplies((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: messageText,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);

      setReplyText("");
      await loadSession({ showLoading: false });
    } catch (error) {
      console.error("Failed to send session reply:", error);
      alert("Failed to send reply. Please check console.");
    } finally {
      setSendingReply(false);
    }
  };

  const handleReplyKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendReply();
    }
  };

  return (
    <>
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Loading session workspace...
        </div>
      ) : !session ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            Session not found
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            This session may have been deleted or the link is invalid.
          </p>

          <button
            type="button"
            onClick={() => navigate(fromPath)}
            className="mt-5 rounded-xl bg-blue-600 h-10 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to {fromLabel}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => navigate(fromPath)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                  title={`Back to ${fromLabel}`}
                >
                  <ArrowLeft size={18} />
                </button>

                <div className="min-w-0">
                  <div className="text-xs text-slate-500">
                    {fromLabel} / Session Workspace
                  </div>

                  <h2 className="mt-1 truncate text-lg font-semibold text-slate-950 sm:text-xl">
                    {session.customer}
                  </h2>

                  <p className="mt-1 wrap-break-word text-sm text-slate-500">
                    {session.id} · {session.channel}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <SessionBadge status={session.status} />

                {session.status !== "Ended" && (
                  <>
                    <button
                      type="button"
                      onClick={handleRaiseTicket}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition-all hover:bg-blue-700"
                    >
                      <Ticket size={16} />
                      Raise Ticket
                    </button>

                    <button
                      type="button"
                      onClick={handleEndSession}
                      disabled={ending}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {ending ? "Ending..." : "End Session"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:h-[calc(100vh-255px)] xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="flex min-h-155 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white xl:min-h-0">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                    <MessageCircle size={19} />
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-950">
                      Customer Conversation
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      Replies update the session latest message only. The
                      messages table is not changed.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-50/70 px-5 py-5">
                <div className="mx-auto max-w-4xl space-y-4">
                  <div className="flex justify-start">
                    <div className="max-w-[76%] rounded-2xl rounded-tl-md bg-white px-4 py-3 text-slate-900 shadow-sm ring-1 ring-slate-200">
                      <div className="text-sm leading-relaxed">
                        {session.lastMessage || "No message yet."}
                      </div>

                      <div className="mt-2 text-xs text-slate-400">
                        {session.customer} · {session.time}
                      </div>
                    </div>
                  </div>

                  {localReplies.map((reply) => (
                    <div key={reply.id} className="flex justify-end">
                      <div className="max-w-[76%] rounded-2xl rounded-tr-md bg-blue-600 px-4 py-3 text-white shadow-sm">
                        <div className="text-sm leading-relaxed">
                          {reply.text}
                        </div>

                        <div className="mt-2 text-xs text-blue-100">
                          Agent Dara · {reply.time}
                        </div>
                      </div>
                    </div>
                  ))}

                  {session.status === "Idle Warning" && (
                    <div className="mx-auto max-w-lg rounded-2xl border border-orange-200 bg-orange-50 p-4 text-center text-sm text-orange-700">
                      Customer has been inactive. The system should warn the
                      customer before ending the session automatically.
                    </div>
                  )}

                  {session.status === "Ended" && (
                    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                      <div className="font-semibold text-slate-800">
                        Session Ended
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        This conversation session is closed. Any raised ticket
                        can continue internally.
                      </p>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>
              </div>

              {session.status !== "Ended" ? (
                <div className="border-t border-slate-200 bg-white p-4">
                  <div className="mx-auto max-w-4xl">
                    <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <textarea
                        rows="2"
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        onKeyDown={handleReplyKeyDown}
                        placeholder="Type your reply to the customer..."
                        className="max-h-32 min-h-11 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-slate-400"
                      />

                      <button
                        type="button"
                        onClick={handleSendReply}
                        disabled={sendingReply || !replyText.trim()}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        title="Send reply"
                      >
                        <SendHorizontal size={18} />
                      </button>
                    </div>

                    <p className="mt-2 text-xs text-slate-400">
                      Press Enter to send. Shift + Enter for a new line.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border-t border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                  Reply disabled because this session has ended.
                </div>
              )}
            </section>

            <aside className="max-h-[calc(100vh-255px)] space-y-4 overflow-y-auto pr-1">
              <section className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-950">
                    Session Details
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Customer session information.
                  </p>
                </div>

                <div className="space-y-3 p-4 text-sm">
                  <Detail label="Session ID" value={session.id} />
                  <Detail label="Channel" value={session.channel} />
                  <Detail label="Status" value={session.status} />
                  <Detail label="Created" value={session.time} />
                  <Detail
                    label="Ended At"
                    value={
                      session.endedAt
                        ? new Date(session.endedAt).toLocaleString()
                        : "Not ended"
                    }
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-950">
                    Customer Information
                  </h3>
                </div>

                <div className="space-y-3 p-4 text-sm">
                  <Detail label="Full Name" value={session.customer} />
                  <Detail
                    label="Phone"
                    value={session.phone || "Not provided"}
                  />
                  <Detail
                    label="Telegram"
                    value={session.telegram || "Not provided"}
                  />
                  <Detail
                    label="Email"
                    value={session.email || "Not provided"}
                  />
                  <Detail
                    label="T.A Coin User ID"
                    value={session.accountId || "Not provided"}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-950">
                    Linked Tickets
                  </h3>
                </div>

                <div className="p-4">
                  {session.linkedTickets.length === 0 ? (
                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                      No ticket has been linked to this session yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {session.linkedTickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="rounded-xl border border-slate-200 p-3 text-sm"
                        >
                          <div className="font-semibold text-slate-900">
                            {ticket.ticket_number}
                          </div>
                          <div className="mt-1 text-slate-500">
                            {ticket.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {session.status === "Ended" && (
                <section className="rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 p-4">
                    <h3 className="font-semibold text-slate-950">
                      Customer Rating
                    </h3>
                  </div>

                  <div className="p-4">
                    {session.rating ? (
                      <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
                        <div className="flex items-center gap-2 font-semibold">
                          <Star size={16} />
                          {session.rating}/5 rating
                        </div>

                        <p className="mt-2">
                          {session.ratingComment || "No comment provided."}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                        No customer rating submitted yet.
                      </div>
                    )}
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                  <p>
                    Session can end while a linked ticket remains open for
                    pending investigation or internal follow-up.
                  </p>
                </div>
              </section>
            </aside>
          </div>
        </div>
      )}
    </>
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
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
};

const Detail = ({ label, value }) => (
  <div>
    <div className="text-xs text-slate-400">{label}</div>
    <div className="break-words font-medium text-slate-800">{value}</div>
  </div>
);

export default SessionWorkspacePage;
