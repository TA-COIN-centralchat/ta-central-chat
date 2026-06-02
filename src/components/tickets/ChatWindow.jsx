import { useEffect, useState, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Lock,
  MessageSquare,
  Paperclip,
  SendHorizontal,
} from 'lucide-react';

import ResolveTicketModal from './ResolveTicketModal';
import EscalateTicketModal from './EscalateTicketModal';
import {
  getMessagesByTicketId,
  sendTicketMessage,
  updateTicketStatus,
} from '../../services/ticketService';
import { subscribeToTicketMessages } from '../../services/realtimeChat';

const ChatWindow = ({ ticket, onTicketUpdated }) => {
  const [showResolve, setShowResolve] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [replyText, setReplyText] = useState('');
  const [activeMode, setActiveMode] = useState('reply');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [localTicketStatus, setLocalTicketStatus] = useState(
    ticket?.status || ''
  );

  const realtimeSubRef = useRef(null);
  const messagesEndRef = useRef(null);

  const isTicketLocked =
    localTicketStatus === 'Resolved' || localTicketStatus === 'Closed';

  const canMarkReadyToContact =
    localTicketStatus === 'Pending Investigation' && !isTicketLocked;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalTicketStatus(ticket?.status || '');
  }, [ticket?.status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!ticket?.dbId) return;

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        const data = await getMessagesByTicketId(ticket.dbId);
        setMessages(data);
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();

    if (realtimeSubRef.current) {
      realtimeSubRef.current.unsubscribe();
    }

    realtimeSubRef.current = subscribeToTicketMessages(ticket.dbId, (rawMsg) => {
      const newMessage = {
        id: rawMsg.id,
        sender: rawMsg.sender_type,
        name: rawMsg.sender_name,
        text: rawMsg.message_text,
        isInternalNote: rawMsg.is_internal_note,
        time: new Date(rawMsg.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
    });

    return () => {
      if (realtimeSubRef.current) {
        realtimeSubRef.current.unsubscribe();
        realtimeSubRef.current = null;
      }
    };
  }, [ticket?.dbId]);

  const handleSendMessage = async () => {
    if (isTicketLocked) {
      alert('This ticket is closed/resolved. You cannot send new messages.');
      return;
    }

    if (!replyText.trim() || !ticket?.dbId) return;

    try {
      setSending(true);

      const newMessage = await sendTicketMessage({
        ticketId: ticket.dbId,
        senderType: 'agent',
        senderName: localStorage.getItem('currentUserName') || 'Agent',
        messageText: replyText.trim(),
        isInternalNote: activeMode === 'internal',
      });

      setMessages((prev) => [...prev, newMessage]);
      setReplyText('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please check console.');
    } finally {
      setSending(false);
    }
  };

  const handleMarkReadyToContact = async () => {
    if (!ticket?.dbId) return;

    const confirmed = window.confirm(
      'Mark this ticket as Ready to Contact Customer?'
    );

    if (!confirmed) return;

    try {
      setUpdatingStatus(true);

      await updateTicketStatus({
        ticketId: ticket.dbId,
        status: 'Ready to Contact Customer',
        auditDetails:
          'Internal investigation completed. Ticket is ready for agent to contact the customer.',
      });

      setLocalTicketStatus('Ready to Contact Customer');

      if (onTicketUpdated) {
        await onTicketUpdated();
      }
    } catch (error) {
      console.error('Failed to update ticket status:', error);
      alert('Failed to update ticket status. Please check console.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (!ticket) {
    return (
      <section className="flex h-full items-center justify-center rounded-[28px] border border-[#e8edf2] bg-white">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f7fbfd] text-[#2389b8] ring-1 ring-[#d8eef7]">
            <MessageSquare size={22} />
          </div>

          <h2 className="mt-4 text-lg font-semibold text-[#1d1d1f]">
            No ticket selected
          </h2>

          <p className="mt-2 text-sm text-[#6e6e73]">
            Select a ticket to view the conversation.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="flex h-full min-w-0 flex-col bg-white">
        <div className="border-b border-[#edf1f5] px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div
                title={ticket.customer}
                className="truncate text-lg font-semibold tracking-[-0.02em] text-[#1d1d1f]"
              >
                {ticket.customer}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#6e6e73]">
                <span title={ticket.id} className="truncate">
                  {ticket.id}
                </span>
                <span>·</span>
                <span>{ticket.channel}</span>
                <span>·</span>
                <StatusText status={localTicketStatus} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {isTicketLocked ? (
                <div className="inline-flex items-center gap-2 rounded-2xl bg-[#f5f5f7] px-3 py-2 text-sm font-medium text-[#6e6e73] ring-1 ring-[#e5e7eb]">
                  <Lock size={16} />
                  Ticket Locked
                </div>
              ) : (
                <>
                  {canMarkReadyToContact && (
                    <button
                      type="button"
                      onClick={handleMarkReadyToContact}
                      disabled={updatingStatus}
                      className="rounded-2xl border border-[#d8eef7] bg-[#f7fbfd] px-3.5 py-2 text-sm font-medium text-[#2389b8] transition hover:bg-[#eef9fd] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updatingStatus
                        ? 'Updating...'
                        : 'Mark Ready to Contact'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowResolve(true)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3.5 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <CheckCircle size={15} />
                    Resolve
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEscalate(true)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-orange-100 bg-orange-50 px-3.5 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-100"
                  >
                    <AlertTriangle size={15} />
                    Escalate
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#fbfbfd] p-5">
          {loadingMessages ? (
            <div className="py-10 text-center text-sm text-[#6e6e73]">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-3xl border border-[#edf1f5] bg-white p-6 text-center shadow-sm">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f7fbfd] text-[#2389b8] ring-1 ring-[#d8eef7]">
                <MessageSquare size={20} />
              </div>

              <h3 className="mt-4 font-semibold text-[#1d1d1f]">
                No messages yet
              </h3>

              <p className="mt-1 text-sm text-[#6e6e73]">
                Messages for this ticket will appear here.
              </p>
            </div>
          ) : (
            messages.map((message) => {
              if (message.sender === 'system') {
                return (
                  <div
                    key={message.id}
                    className="mx-auto max-w-fit rounded-full bg-white px-4 py-2 text-center text-xs text-[#6e6e73] ring-1 ring-[#edf1f5]"
                  >
                    {message.text} · {message.time}
                  </div>
                );
              }

              if (message.isInternalNote) {
                return (
                  <div
                    key={message.id}
                    className="rounded-[22px] border border-[#ffe88a] bg-[#fffbea] p-4 text-sm text-[#7a5d00]"
                  >
                    <div className="font-semibold">Internal Note</div>

                    <div className="mt-1 whitespace-pre-wrap leading-6">
                      {message.text}
                    </div>

                    <div className="mt-2 text-xs text-[#8a6d00]">
                      {message.name} · {message.time}
                    </div>
                  </div>
                );
              }

              const isAgent = message.sender === 'agent';

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    isAgent ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[75%] rounded-[22px] px-4 py-3 shadow-sm ${
                      isAgent
                        ? 'bg-[#43acd6] text-white'
                        : 'bg-white text-[#1d1d1f] ring-1 ring-[#edf1f5]'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm leading-6">
                      {message.text}
                    </div>

                    <div
                      className={`mt-2 text-xs ${
                        isAgent ? 'text-blue-50' : 'text-[#8e8e93]'
                      }`}
                    >
                      {message.name} · {message.time}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-[#edf1f5] bg-white p-4">
          {isTicketLocked ? (
            <div className="rounded-3xl border border-[#e5e7eb] bg-[#f8fafc] p-4 text-center">
              <div className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#1d1d1f]">
                <Lock size={16} />
                This ticket is {localTicketStatus}
              </div>

              <p className="mt-1 text-sm text-[#6e6e73]">
                Conversation is locked. Agents can view history but cannot send
                new replies or internal notes.
              </p>
            </div>
          ) : (
            <>
              {localTicketStatus === 'Ready to Contact Customer' && (
                <div className="mb-3 rounded-[18px] border border-[#d8eef7] bg-[#f7fbfd] p-3 text-sm leading-6 text-[#2389b8]">
                  Internal investigation is completed. Contact the customer,
                  then move the ticket to Waiting for Customer or Resolve it
                  after confirmation.
                </div>
              )}

              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveMode('reply')}
                  className={`rounded-2xl px-3.5 py-1.5 text-sm font-medium transition ${
                    activeMode === 'reply'
                      ? 'bg-[#f7fbfd] text-[#2389b8] ring-1 ring-[#d8eef7]'
                      : 'text-[#6e6e73] hover:bg-[#f5f5f7]'
                  }`}
                >
                  Reply
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode('internal')}
                  className={`rounded-2xl px-3.5 py-1.5 text-sm font-medium transition ${
                    activeMode === 'internal'
                      ? 'bg-[#fffbea] text-[#8a6d00] ring-1 ring-[#ffe88a]'
                      : 'text-[#6e6e73] hover:bg-[#f5f5f7]'
                  }`}
                >
                  Internal Note
                </button>
              </div>

              <div className="flex items-end gap-3 rounded-3xl border border-[#e8edf2] bg-[#f8fafc] p-3">
                <button
                  type="button"
                  className="rounded-2xl p-2 text-[#8e8e93] transition hover:bg-white hover:text-[#2389b8]"
                >
                  <Paperclip size={18} />
                </button>

                <textarea
                  rows="2"
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder={
                    activeMode === 'reply'
                      ? 'Type your reply to customer...'
                      : 'Type internal note for staff only...'
                  }
                  className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-1 py-1 text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
                />

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={sending || !replyText.trim()}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#43acd6] text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:bg-[#2389b8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <SendHorizontal size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <ResolveTicketModal
        open={showResolve}
        onClose={() => setShowResolve(false)}
        ticket={ticket}
        onUpdated={(newStatus) => {
          setLocalTicketStatus(newStatus);

          if (onTicketUpdated) {
            onTicketUpdated();
          }
        }}
      />

      <EscalateTicketModal
        open={showEscalate}
        onClose={() => setShowEscalate(false)}
        ticket={ticket}
        onUpdated={(newStatus) => {
          setLocalTicketStatus(newStatus);

          if (onTicketUpdated) {
            onTicketUpdated();
          }
        }}
      />
    </>
  );
};

const StatusText = ({ status }) => {
  const normalized = status?.toLowerCase().trim();

  const className =
    normalized === 'resolved' || normalized === 'closed'
      ? 'text-emerald-700 dark:text-emerald-500'
      : normalized === 'pending investigation' ||
        normalized === 'pending' ||
        normalized === 'pending review'
      ? 'text-orange-700 dark:text-orange-500'
      : normalized === 'ready to contact customer' ||
        normalized === 'ready to contact'
      ? 'text-[#2389b8] dark:text-[#43acd6]'
      : normalized === 'new'
      ? 'text-[#8a6d00] dark:text-yellow-500'
      : 'text-[#6e6e73] dark:text-[#a1a1a6]';

  return <span className={`font-medium ${className}`}>{status}</span>;
};

export default ChatWindow;