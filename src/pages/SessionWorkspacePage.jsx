/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  CheckCircle,
  Clock,
  MessageCircle,
  Phone,
  SendHorizontal,
  ShieldCheck,
  Star,
  Ticket,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import DashboardLayout from '../components/layout/DashboardLayout';
import {
  endSession,
  getSessionById,
  sendSessionReply,
} from '../services/sessionService';

import { supabase } from '../services/supabaseClient';

const SessionWorkspacePage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const chatEndRef = useRef(null);

  const fromPath = location.state?.from || '/telegram';
  const fromLabel = location.state?.fromLabel || 'Channel Sessions';
  const mode = location.state?.mode;

  const isTelegramMode =
    mode === 'telegram-chat' || location.pathname.startsWith('/telegram');

  const [session, setSession] = useState(null);
  const [telegramMessages, setTelegramMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);

  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [localReplies, setLocalReplies] = useState([]);

  const mapTelegramSession = (chatSession, messages = []) => {
    const metadata = chatSession.metadata || {};
    const latestMessage = messages[messages.length - 1];

    return {
      dbId: chatSession.id,
      id: chatSession.id,
      customer:
        metadata.customerName ||
        metadata.fullName ||
        chatSession.user_id ||
        'Telegram Customer',
      phone: metadata.phone || '',
      telegram: metadata.telegramUsername
        ? `@${metadata.telegramUsername}`
        : metadata.telegramChatId || chatSession.user_id || '',
      email: '',
      accountId: '',
      channel: chatSession.channel || metadata.channel || 'Telegram',
      avatarUrl:
        metadata.photoUrl ||
        metadata.avatarUrl ||
        metadata.photo_url ||
        chatSession.customers?.photo_url ||
        '',
      status: mapTelegramStatus(chatSession.status),
      lastMessage:
        latestMessage?.content ||
        metadata.issueDescription ||
        'No message yet.',
      rating: null,
      ratingComment: '',
      endedAt: metadata.endedAt || null,
      createdAt: chatSession.created_at,
      time: chatSession.created_at
        ? new Date(chatSession.created_at).toLocaleString()
        : 'N/A',
      linkedTickets: [],
      issueType: metadata.issueType || '',
      issueDescription: metadata.issueDescription || '',
      assignedAgentName:
        metadata.assignedAgentName || chatSession.agent_id || 'Unassigned',
      raw: chatSession,
    };
  };

  const loadTelegramSession = async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) setLoading(true);

      const { data: chatSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      const { data: messages, error: messageError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (messageError) throw messageError;

      setTelegramMessages(messages || []);
      setSession(mapTelegramSession(chatSession, messages || []));
    } catch (error) {
      console.error('Failed to load Telegram session workspace:', error);
      setSession(null);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const loadOldSession = async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) setLoading(true);

      const data = await getSessionById(sessionId);
      setSession(data);
    } catch (error) {
      console.error('Failed to load old session workspace:', error);
      setSession(null);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const loadSession = async ({ showLoading = true } = {}) => {
    if (isTelegramMode) {
      await loadTelegramSession({ showLoading });
      return;
    }

    await loadOldSession({ showLoading });
  };

  useEffect(() => {
    loadSession();

    if (!isTelegramMode) return undefined;

    const messageSub = supabase
      .channel(`telegram-session-messages-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadTelegramSession({ showLoading: false });
        }
      )
      .subscribe();

    const sessionSub = supabase
      .channel(`telegram-session-status-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_sessions',
          filter: `id=eq.${sessionId}`,
        },
        () => {
          loadTelegramSession({ showLoading: false });
        }
      )
      .subscribe();

    return () => {
      messageSub.unsubscribe();
      sessionSub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isTelegramMode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localReplies, telegramMessages, session?.lastMessage]);

  const sendTelegramTextOnly = async (text) => {
    const { data, error } = await supabase.functions.invoke(
      'send-telegram-reply',
      {
        body: {
          sessionId: session.dbId,
          text,
        },
      }
    );

    if (error) throw error;

    if (data?.ok === false) {
      throw new Error(data?.error || 'Failed to send message to Telegram.');
    }
  };

  const handleEndSession = async () => {
    if (!session?.dbId) return;

    const confirmed = window.confirm(
      'End this Telegram conversation session? The linked ticket can still continue internally.'
    );

    if (!confirmed) return;

    try {
      setEnding(true);

      if (isTelegramMode) {
        const metadata = session.raw?.metadata || {};
        const endedMessage =
          'This support session has ended. If you need more help, please send /start to begin a new request.';

        await supabase
          .from('chat_sessions')
          .update({
            status: 'closed',
            updated_at: new Date().toISOString(),
            metadata: {
              ...metadata,
              endedAt: new Date().toISOString(),
              endedReason: 'closed_by_agent',
            },
          })
          .eq('id', session.dbId);

        await supabase.from('chat_messages').insert({
          session_id: session.dbId,
          sender_role: 'system',
          sender_id: 'system',
          content: endedMessage,
          metadata: {
            source: 'telegram',
            type: 'agent_closed',
          },
        });

        await sendTelegramTextOnly(endedMessage);
        await loadTelegramSession({ showLoading: false });
        return;
      }

      await endSession(session.dbId);
      await loadSession({ showLoading: false });
    } catch (error) {
      console.error('Failed to end session:', error);
      alert('Failed to end session. Please check console.');
    } finally {
      setEnding(false);
    }
  };

  const handleRaiseTicket = () => {
    navigate('/manual-ticket', {
      state: {
        fromSession: true,
        from: fromPath,
        fromLabel,
        sessionId: session.dbId,
        sessionNumber: session.id,
        customerName: session.customer,
        phone: session.phone,
        telegram: session.telegram,
        email: session.email,
        accountId: session.accountId,
        channel: session.channel,
        issueDescription: session.issueDescription || session.lastMessage,
        internalNote: `Created from ${session.channel} session: ${session.id}`,
      },
    });
  };

  const handleSendTelegramReply = async (messageText) => {
    const agentId = localStorage.getItem('currentAgentId') || 'agent_dashboard';
    const agentName = localStorage.getItem('currentUserName') || 'Agent';

    const { error: messageError } = await supabase.from('chat_messages').insert({
      session_id: session.dbId,
      sender_role: 'agent',
      sender_id: agentId,
      content: messageText,
      metadata: {
        source: 'telegram',
        agentName,
      },
    });

    if (messageError) throw messageError;

    await sendTelegramTextOnly(messageText);

    await supabase
      .from('chat_sessions')
      .update({
        updated_at: new Date().toISOString(),
        metadata: {
          ...(session.raw?.metadata || {}),
          lastActivityAt: new Date().toISOString(),
          lastAgentReplyAt: new Date().toISOString(),
        },
      })
      .eq('id', session.dbId);

    await loadTelegramSession({ showLoading: false });
  };

  const handleSendReply = async () => {
    if (!session?.dbId) return;

    if (!replyText.trim()) {
      alert('Please enter a reply.');
      return;
    }

    const messageText = replyText.trim();

    try {
      setSendingReply(true);

      if (isTelegramMode) {
        await handleSendTelegramReply(messageText);
        setReplyText('');
        return;
      }

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
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);

      setReplyText('');
      await loadSession({ showLoading: false });
    } catch (error) {
      console.error('Failed to send session reply:', error);
      alert('Failed to send reply. Please check console.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleReplyKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendReply();
    }
  };

  const conversationMessages = isTelegramMode
    ? telegramMessages
    : [
        {
          id: 'last-message',
          sender_role: 'user',
          content: session?.lastMessage || 'No message yet.',
          created_at: session?.createdAt,
          metadata: {},
        },
      ];

  return (
    <DashboardLayout
      title={isTelegramMode ? 'Telegram Session Workspace' : 'Session Workspace'}
      description={
        isTelegramMode
          ? 'Manage Telegram customer conversations and reply directly from the support dashboard.'
          : 'Chat with the customer, then raise a ticket only when a real issue needs tracking.'
      }
    >
      {loading ? (
        <div className="flex min-h-72 items-center justify-center rounded-[28px] border border-black/6 bg-white/90 p-10 text-center text-sm text-[#6e6e73] shadow-[0_14px_40px_rgba(0,0,0,0.035)]">
          Loading session workspace...
        </div>
      ) : !session ? (
        <div className="rounded-[28px] border border-black/6 bg-white/90 p-10 text-center shadow-[0_14px_40px_rgba(0,0,0,0.035)]">
          <h2 className="text-lg font-semibold text-[#1d1d1f]">
            Session not found
          </h2>

          <p className="mt-2 text-sm text-[#6e6e73]">
            This session may have been deleted or the link is invalid.
          </p>

          <button
            type="button"
            onClick={() => navigate(fromPath)}
            className="mt-5 rounded-2xl bg-[#43acd6] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2389b8]"
          >
            Back to {fromLabel}
          </button>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl space-y-5">
          <section className="overflow-hidden rounded-[28px] border border-black/6 bg-white/90 shadow-[0_14px_40px_rgba(0,0,0,0.035)] backdrop-blur">
            <div className="flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <button
                  type="button"
                  onClick={() => navigate(fromPath)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-black/[0.07] bg-[#f5f5f7] text-[#6e6e73] transition hover:bg-white hover:text-[#1d1d1f]"
                  title={`Back to ${fromLabel}`}
                >
                  <ArrowLeft size={18} />
                </button>

                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#eef9fd] text-[#2389b8] ring-1 ring-[#43acd6]/15">
                    {session.avatarUrl ? (
                      <img
                        src={session.avatarUrl}
                        alt={session.customer}
                        className="h-full w-full object-cover"
                      />
                    ) : isTelegramMode ? (
                      <Bot size={21} />
                    ) : (
                      <MessageCircle size={21} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2
                        title={session.customer}
                        className="max-w-105 truncate text-lg font-semibold tracking-[-0.02em] text-[#1d1d1f]"
                      >
                        {session.customer}
                      </h2>

                      <SessionBadge status={session.status} />
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#8e8e93]">
                      <span title={session.id}>{shortId(session.id)}</span>
                      <span>•</span>
                      <span>{session.channel}</span>
                      <span>•</span>
                      <span>{session.time}</span>
                    </div>

                    {session.issueType && (
                      <div className="mt-2 inline-flex max-w-full rounded-full bg-[#eef9fd] px-3 py-1 text-xs font-medium text-[#2389b8] ring-1 ring-[#43acd6]/15">
                        <span className="truncate">{session.issueType}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {session.status !== 'Ended' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRaiseTicket}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#43acd6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:bg-[#2389b8]"
                  >
                    <Ticket size={16} />
                    Raise Ticket
                  </button>

                  <button
                    type="button"
                    onClick={handleEndSession}
                    disabled={ending}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <XCircle size={16} />
                    {ending ? 'Ending...' : 'End Session'}
                  </button>
                </div>
              )}
            </div>
          </section>

          {isTelegramMode && session.status === 'Active' && (
            <section className="rounded-[22px] border border-emerald-100 bg-emerald-50 px-5 py-3 text-sm text-emerald-700">
              <div className="flex items-start gap-3">
                <CheckCircle size={17} className="mt-0.5 shrink-0" />
                <p>
                  This Telegram session is active. Replies sent here will be
                  saved in the dashboard and delivered to the customer in
                  Telegram.
                </p>
              </div>
            </section>
          )}

          {session.status === 'Waiting' && (
            <section className="rounded-[22px] border border-orange-100 bg-orange-50 px-5 py-3 text-sm text-orange-700">
              <div className="flex items-start gap-3">
                <Clock size={17} className="mt-0.5 shrink-0" />
                <p>
                  This session is waiting for an available agent. You can still
                  review the customer details and issue context.
                </p>
              </div>
            </section>
          )}

          <div className="grid gap-5 xl:h-[calc(100vh-280px)] xl:min-h-150 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="flex min-h-155 flex-col overflow-hidden rounded-[28px] border border-black/6 bg-white/90 shadow-[0_14px_40px_rgba(0,0,0,0.035)] xl:min-h-0">
              <div className="border-b border-black/6 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
                    <MessageCircle size={18} />
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-[#1d1d1f]">
                      Customer Conversation
                    </h3>

                    <p className="mt-0.5 text-xs text-[#6e6e73]">
                      {isTelegramMode
                        ? 'Reply directly to the Telegram customer from here.'
                        : 'Replies update the session latest message only.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfbfd] px-5 py-5">
                <div className="mx-auto max-w-4xl space-y-4">
                  {conversationMessages.map((message) => {
                    const isAgent = message.sender_role === 'agent';
                    const isSystem =
                      message.sender_role === 'system' ||
                      message.sender_role === 'bot';

                    if (isSystem) {
                      return (
                        <div
                          key={message.id}
                          className="mx-auto max-w-fit rounded-full bg-white px-4 py-2 text-center text-xs text-[#6e6e73] ring-1 ring-black/6"
                        >
                          {message.content}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          isAgent ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[78%] rounded-[22px] px-4 py-3 shadow-sm ${
                            isAgent
                              ? 'bg-[#43acd6] text-white'
                              : 'bg-white text-[#1d1d1f] ring-1 ring-black/6'
                          }`}
                        >
                          <div className="whitespace-pre-wrap text-sm leading-6">
                            {message.content || 'No message.'}
                          </div>

                          <div
                            className={`mt-2 text-xs ${
                              isAgent ? 'text-blue-50' : 'text-[#8e8e93]'
                            }`}
                          >
                            {isAgent
                              ? message.metadata?.agentName || 'Agent'
                              : session.customer}{' '}
                            · {formatMessageTime(message.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!isTelegramMode &&
                    localReplies.map((reply) => (
                      <div key={reply.id} className="flex justify-end">
                        <div className="max-w-[78%] rounded-[22px] bg-[#43acd6] px-4 py-3 text-white shadow-sm">
                          <div className="text-sm leading-6">{reply.text}</div>

                          <div className="mt-2 text-xs text-blue-50">
                            Agent · {reply.time}
                          </div>
                        </div>
                      </div>
                    ))}

                  {session.status === 'Ended' && (
                    <div className="mx-auto max-w-lg rounded-[22px] border border-black/6 bg-white p-4 text-center shadow-sm">
                      <div className="font-semibold text-[#1d1d1f]">
                        Session Ended
                      </div>

                      <p className="mt-1 text-sm text-[#6e6e73]">
                        This conversation session is closed. Any raised ticket
                        can continue internally.
                      </p>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>
              </div>

              {session.status !== 'Ended' ? (
                <div className="border-t border-black/6 bg-white px-4 py-4">
                  <div className="mx-auto max-w-4xl">
                    <div className="flex items-end gap-3 rounded-3xl border border-black/6 bg-[#f5f5f7] p-3">
                      <textarea
                        rows="2"
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        onKeyDown={handleReplyKeyDown}
                        placeholder={
                          isTelegramMode
                            ? 'Type your Telegram reply to the customer...'
                            : 'Type your reply to the customer...'
                        }
                        className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-1 text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
                      />

                      <button
                        type="button"
                        onClick={handleSendReply}
                        disabled={sendingReply || !replyText.trim()}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#43acd6] text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:bg-[#2389b8] disabled:cursor-not-allowed disabled:opacity-60"
                        title="Send reply"
                      >
                        <SendHorizontal size={18} />
                      </button>
                    </div>

                    <p className="mt-2 text-xs text-[#8e8e93]">
                      {isTelegramMode
                        ? 'Message will be saved in the dashboard and sent to the customer on Telegram.'
                        : 'Press Enter to send. Shift + Enter for a new line.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border-t border-black/6 bg-[#f5f5f7] p-4 text-center text-sm text-[#6e6e73]">
                  Reply disabled because this session has ended.
                </div>
              )}
            </section>

            <aside className="max-h-[calc(100vh-280px)] space-y-4 overflow-y-auto pr-1">
              <SideCard
                title="Customer Information"
                description="Contact details collected from the session."
              >
                <div className="space-y-4 text-sm">
                  <SideInfo
                    icon={UserRound}
                    label="Full Name"
                    value={session.customer}
                  />

                  <SideInfo
                    icon={Phone}
                    label="Phone"
                    value={session.phone || 'Not provided'}
                  />

                  <SideInfo
                    icon={Bot}
                    label="Telegram"
                    value={session.telegram || 'Not provided'}
                  />
                </div>
              </SideCard>

              {session.issueType && (
                <section className="rounded-3xl border border-[#43acd6]/15 bg-[#eef9fd] p-4 text-sm text-[#2389b8] shadow-sm">
                  <div className="font-semibold">Issue Context</div>

                  <p className="mt-3">
                    <span className="font-semibold">Type:</span>{' '}
                    {session.issueType}
                  </p>

                  <p className="mt-3 leading-6">
                    <span className="font-semibold">Description:</span>{' '}
                    {session.issueDescription || 'Not provided'}
                  </p>
                </section>
              )}

              <SideCard title="Session Details">
                <div className="space-y-3 text-sm">
                  <Detail label="Session ID" value={shortId(session.id)} />
                  <Detail label="Channel" value={session.channel} />
                  <Detail label="Status" value={session.status} />
                  <Detail label="Created" value={session.time} />

                  <Detail
                    label="Assigned Agent"
                    value={session.assignedAgentName || 'Unassigned'}
                  />

                  <Detail
                    label="Ended At"
                    value={
                      session.endedAt
                        ? new Date(session.endedAt).toLocaleString()
                        : 'Not ended'
                    }
                  />
                </div>
              </SideCard>

              {session.status === 'Ended' && (
                <SideCard title="Customer Rating">
                  {session.rating ? (
                    <div className="rounded-2xl bg-[#eef9fd] p-4 text-sm text-[#2389b8]">
                      <div className="flex items-center gap-2 font-semibold">
                        <Star size={16} />
                        {session.rating}/5 rating
                      </div>

                      <p className="mt-2">
                        {session.ratingComment || 'No comment provided.'}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-[#f5f5f7] p-4 text-sm text-[#6e6e73]">
                      No customer rating submitted yet.
                    </div>
                  )}
                </SideCard>
              )}

              <section className="rounded-3xl border border-[#43acd6]/15 bg-[#eef9fd] p-4 text-sm text-[#2389b8] shadow-sm">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0" />

                  <p>
                    If the issue needs tracking, raise a ticket from this
                    session. The session can end while the ticket continues
                    internally.
                  </p>
                </div>
              </section>
            </aside>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

const mapTelegramStatus = (status) => {
  const value = String(status || '').toLowerCase();

  if (value === 'active') return 'Active';
  if (value === 'waiting') return 'Waiting';
  if (value === 'closed' || value === 'ended') return 'Ended';

  return status || 'Waiting';
};

const SessionBadge = ({ status }) => {
  const className =
    status === 'Active'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
      : status === 'Waiting' || status === 'Idle Warning'
      ? 'bg-orange-50 text-orange-700 ring-orange-100'
      : 'bg-red-50 text-red-700 ring-red-100';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'Active'
            ? 'bg-emerald-500'
            : status === 'Ended'
            ? 'bg-red-500'
            : 'bg-orange-500'
        }`}
      />
      {status}
    </span>
  );
};

const SideCard = ({ title, description, children }) => {
  return (
    <section className="rounded-3xl border border-black/6 bg-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.025)]">
      <div className="border-b border-black/6 p-4">
        <h3 className="text-sm font-semibold text-[#1d1d1f]">{title}</h3>

        {description && (
          <p className="mt-1 text-xs leading-5 text-[#6e6e73]">
            {description}
          </p>
        )}
      </div>

      <div className="p-4">{children}</div>
    </section>
  );
};

const Detail = ({ label, value }) => (
  <div>
    <div className="text-xs text-[#8e8e93]">{label}</div>
    <div className="wrap-break-word font-medium text-[#1d1d1f]">{value}</div>
  </div>
);

const SideInfo = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f5f5f7] text-[#6e6e73]">
      <Icon size={17} />
    </div>

    <div className="min-w-0">
      <div className="text-xs text-[#8e8e93]">{label}</div>
      <div className="wrap-break-word font-medium text-[#1d1d1f]">{value}</div>
    </div>
  </div>
);

const formatMessageTime = (dateStr) => {
  if (!dateStr) return 'N/A';

  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const shortId = (id) => {
  if (!id) return 'N/A';

  return String(id).length > 12 ? `${String(id).slice(0, 8)}...` : id;
};

export default SessionWorkspacePage;