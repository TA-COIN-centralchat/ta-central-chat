import { useEffect, useState, useRef } from 'react';
import { Lock, Paperclip, SendHorizontal, Image as ImageIcon } from 'lucide-react';
import ResolveTicketModal from './ResolveTicketModal';
import EscalateTicketModal from './EscalateTicketModal';
import {
  getMessagesByTicketId,
  sendTicketMessage,
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
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const [localTicketStatus, setLocalTicketStatus] = useState(
    ticket?.status || ''
  );

  const realtimeSubRef = useRef(null);
  const messagesEndRef = useRef(null);

  const isTicketLocked =
    localTicketStatus === 'Resolved' || localTicketStatus === 'Closed';

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalTicketStatus(ticket?.status || '');
  }, [ticket?.status]);

  // Auto-scroll to bottom when messages change
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

    // Subscribe to realtime message inserts for this ticket
    if (realtimeSubRef.current) {
      realtimeSubRef.current.unsubscribe();
    }

    realtimeSubRef.current = subscribeToTicketMessages(ticket.dbId, (rawMsg) => {
      // Transform the raw DB row to match the format from getMessagesByTicketId
      const newMessage = {
        id: rawMsg.id,
        sender: rawMsg.sender_type,
        name: rawMsg.sender_name,
        text: rawMsg.message_text,
        attachmentUrl: rawMsg.attachment_url || null,
        isInternalNote: rawMsg.is_internal_note,
        time: new Date(rawMsg.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setMessages((prev) => {
        // Prevent duplicates (the optimistic insert from handleSendMessage)
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
        senderName: 'Agent Dara',
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

  if (!ticket) {
    return (
      <section className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            No ticket selected
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Select a ticket to view the conversation.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-950">
                {ticket.customer}
              </div>

              <div className="mt-1 text-sm text-slate-500">
                {ticket.id} · {ticket.channel} · {localTicketStatus}
              </div>
            </div>

            <div className="flex gap-2">
              {isTicketLocked ? (
                <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
                  <Lock size={16} />
                  Ticket Locked
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowResolve(true)}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    Resolve
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEscalate(true)}
                    className="rounded-xl bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700"
                  >
                    Escalate
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {loadingMessages ? (
            <div className="text-center text-sm text-slate-500">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-6 text-center">
              <h3 className="font-semibold text-slate-900">No messages yet</h3>
              <p className="mt-1 text-sm text-slate-500">
                Messages for this ticket will appear here.
              </p>
            </div>
          ) : (
            messages.map((message) => {
              if (message.sender === 'system') {
                return (
                  <div
                    key={message.id}
                    className="rounded-full bg-slate-100 px-4 py-2 text-center text-xs text-slate-500"
                  >
                    {message.text} · {message.time}
                  </div>
                );
              }

              if (message.isInternalNote) {
                return (
                  <div
                    key={message.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
                  >
                    <div className="font-semibold">Internal Note</div>
                    <div className="mt-1">{message.text}</div>
                    <div className="mt-2 text-xs text-amber-600">
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
                    className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                      isAgent
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    <div className="text-sm leading-relaxed">
                      {message.attachmentUrl ? (
                        <>
                          {message.text !== '[Image]' && <p>{message.text}</p>}
                          <img
                            src={message.attachmentUrl}
                            alt="Attachment"
                            className="mt-2 max-h-52 max-w-full cursor-pointer rounded-xl border border-slate-200 object-cover transition hover:opacity-90"
                            onClick={() => setLightboxUrl(message.attachmentUrl)}
                          />
                        </>
                      ) : (
                        message.text
                      )}
                    </div>

                    <div
                      className={`mt-2 text-xs ${
                        isAgent ? 'text-blue-100' : 'text-slate-400'
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

        <div className="border-t border-slate-200 p-4">
          {isTicketLocked ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <div className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-700">
                <Lock size={16} />
                This ticket is {localTicketStatus}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Conversation is locked. Agents can view history but cannot send new replies or internal notes.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveMode('reply')}
                  className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
                    activeMode === 'reply'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Reply
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode('internal')}
                  className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
                    activeMode === 'internal'
                      ? 'bg-amber-50 text-amber-700'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Internal Note
                </button>
              </div>

              <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <button
                  type="button"
                  className="rounded-xl p-2 text-slate-500 hover:bg-white"
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
                  className="flex-1 resize-none bg-transparent text-sm outline-none"
                />

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={sending || !replyText.trim()}
                  className="rounded-xl bg-blue-600 p-3 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <SendHorizontal size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      </section>

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

export default ChatWindow;