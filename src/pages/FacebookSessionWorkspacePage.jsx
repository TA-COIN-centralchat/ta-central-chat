/* eslint-disable react-hooks/set-state-in-effect */
import { convertVoiceToOgg } from '../utils/convertVoiceToOgg';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  AtSign,
  Bot,
  CheckCircle,
  Clock,
  Hash,
  IdCard,
  Mail,
  MessageCircle,
  Mic,
  Pause,
  Phone,
  Play,
  SendHorizontal,
  ShieldCheck,
  Square,
  Star,
  Ticket,
  Trash2,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import DashboardLayout from '../components/layout/DashboardLayout';
import {
  endSession,
  sendAgentVoiceReply,
  getSessionById,
} from '../services/sessionService';

import { supabase } from '../services/supabaseClient';
import { shortId, formatMessageTime } from '../utils/format';
import { getCurrentAgentId, getCurrentUserRole } from '../utils/authUtils';
import { parseSupportForm } from '../utils/supportForm';

const resolveVoiceAttachment = (message) => {
  if (!message) return null;

  const meta =
    message.metadata && typeof message.metadata === 'object'
      ? message.metadata
      : {};

  const url =
    message.attachment_url ||
    meta.attachment_url ||
    meta.voice_url ||
    meta.voiceUrl ||
    null;

  const bucket =
    meta.bucket ||
    meta.storageBucket ||
    meta.storage_bucket ||
    'voice-messages';

  const storagePath =
    meta.storagePath ||
    meta.storage_path ||
    null;

  if (!url && !storagePath) {
    return null;
  }

  const mimeType = String(
    meta.mimeType ||
      meta.mime_type ||
      meta.contentType ||
      '',
  ).toLowerCase();

  const kind = String(
    meta.kind ||
      meta.attachment_type ||
      meta.attachmentType ||
      meta.type ||
      '',
  ).toLowerCase();

  const fileName = String(
    meta.fileName ||
      meta.file_name ||
      meta.name ||
      '',
  ).toLowerCase();

  const audioReference =
    url ||
    storagePath ||
    fileName ||
    '';

  const isVoiceKind = [
    'voice',
    'audio',
  ].some((token) =>
    kind.includes(token),
  );

  const isAudioMime =
    mimeType.startsWith('audio/');

  const isAudioByExtension =
    /\.(ogg|oga|opus|mp3|m4a|wav|webm)(\?|#|$)/i.test(
      audioReference,
    );

  if (
    !isVoiceKind &&
    !isAudioMime &&
    !isAudioByExtension
  ) {
    return null;
  }

  return {
    url,
    bucket,
    storagePath,
    mimeType:
      mimeType || 'audio/webm',
    durationSec:
      Number(meta.duration) || null,
  };
};

const FacebookSessionWorkspacePage = () => {
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
  const [accessDenied, setAccessDenied] = useState(false);

  // Client-side access guard. The list views already hide sessions an agent
  // shouldn't see, but URLs are shareable / guessable, so we re-check here.
  // This is a defense-in-depth check; the authoritative gate should be
  // Supabase RLS on chat_sessions.
  const viewerAgentId = getCurrentAgentId();
  const viewerIsAdmin = getCurrentUserRole() === 'Admin';
  const canAccessSession = (assignedAgentId, status) => {
    if (viewerIsAdmin) return true;
    if (!viewerAgentId) return false;
    if (!assignedAgentId && String(status).toLowerCase() === 'waiting') return true;
    return assignedAgentId === viewerAgentId;
  };

  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Voice recording state (Telegram mode only). The MediaRecorder instance and
  // collected chunks live in refs so re-renders don't tear down the in-progress
  // recording.
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef(null);
  // localReplies is kept as an inert empty array. The optimistic-reply UX it
  // used to drive caused duplication once sendSessionReply started writing
  // real chat_messages rows. Leaving the state and render block in place so
  // it's trivial to re-enable later if the UX team wants instant feedback
  // before the realtime echo lands.
  const [localReplies] = useState([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [profileOpen, setProfileOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const mapTelegramSession = (chatSession, messages = []) => {
    const metadata = chatSession.metadata || {};
    const latestMessage = messages[messages.length - 1];

    // Legacy fallback for sessions written before the widget started writing
    // structured customer info to metadata. The pre-chat form fields lived in
    // the first user message; parseSupportForm scans that text line-by-line.
    const firstUserMessage = (messages || []).find(
      (m) => m?.sender_role === 'user' || m?.sender_role === 'customer',
    );
    const fallback = parseSupportForm(firstUserMessage?.content || '');

    // For Telegram sessions the bot has been observed writing free-form text
    // (sometimes the customer's first message) into metadata.customerName.
    // Prefer the real Telegram identifiers so the header / message
    // attribution / notifications stay stable.
    const telegramFirstName =
      metadata.telegramFirstName || metadata.firstName || '';
    const telegramLastName =
      metadata.telegramLastName || metadata.lastName || '';
    const telegramFullName = [telegramFirstName, telegramLastName]
      .filter(Boolean)
      .join(' ');
    const telegramHandle = metadata.telegramUsername
      ? `@${metadata.telegramUsername}`
      : '';

    return {
      dbId: chatSession.id,
      id: chatSession.id,
      customer:
        // Telegram-specific identifiers win over the unreliable customerName.
        (isTelegramMode && (telegramHandle || telegramFullName)) ||
        metadata.customerName ||
        metadata.fullName ||
        fallback.customerName ||
        telegramHandle ||
        telegramFullName ||
        chatSession.user_id ||
        'Telegram Customer',
      phone:
        metadata.phone ||
        chatSession.customers?.phone ||
        fallback.phone ||
        '',
      telegram: metadata.telegramUsername
        ? `@${metadata.telegramUsername}`
        : metadata.telegramChatId || chatSession.user_id || '',
      // For Website Chatbot sessions the customer enters their email in the
      // pre-chat form. Source-of-truth order:
      //   1. customers row (post-restructure)
      //   2. structured metadata.email (post-restructure widget build)
      //   3. metadata.customerEmail (alternate key)
      //   4. parsed from first user message (legacy sessions only)
      email:
        chatSession.customers?.email ||
        metadata.email ||
        metadata.customerEmail ||
        fallback.email ||
        '',
      accountId:
        chatSession.customers?.ta_coin_user_id ||
        metadata.accountId ||
        '',
      channel: chatSession.channel || metadata.channel || 'Telegram',
      avatarUrl:
        metadata.photoUrl ||
        metadata.avatarUrl ||
        metadata.photo_url ||
        chatSession.customers?.photo_url ||
        '',
      // Prefer first-class columns from chat_sessions; fall back to the
      // metadata mirror for any row written before the migration.
      expiresAt: chatSession.expires_at || metadata.expiresAt,
      warningSentAt: chatSession.warning_sent_at || metadata.warningSentAt,
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
      issueType: metadata.issueType || fallback.issueType || '',
      issueDescription:
        metadata.issueDescription || fallback.issueDescription || '',
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

      // Accept the legacy agent_id column too — the Telegram bot may still
      // be writing there instead of assigned_agent_id.
      if (
        !canAccessSession(
          chatSession.assigned_agent_id || chatSession.agent_id,
          chatSession.status,
        )
      ) {
        setAccessDenied(true);
        setSession(null);
        setTelegramMessages([]);
        return;
      }

      const { data: messages, error: messageError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (messageError) throw messageError;

      setAccessDenied(false);
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

      if (!canAccessSession(data?.assignedAgentId, data?.status)) {
        setAccessDenied(true);
        setSession(null);
        setTelegramMessages([]);
        return;
      }

      const { data: messages, error: messageError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (messageError) throw messageError;

      setAccessDenied(false);
      setTelegramMessages(messages || []);
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

    const messageSub = supabase
      .channel(`session-messages-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          if (isTelegramMode) {
            loadTelegramSession({ showLoading: false });
          } else {
            loadOldSession({ showLoading: false });
          }
        }
      )
      .subscribe();

    const sessionSub = supabase
      .channel(`session-status-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_sessions',
          filter: `id=eq.${sessionId}`,
        },
        () => {
          if (isTelegramMode) {
            loadTelegramSession({ showLoading: false });
          } else {
            loadOldSession({ showLoading: false });
          }
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
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

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

      await endSession(session.dbId);
      if (isTelegramMode) {
        await sendTelegramTextOnly('This support session has ended. If you need more help, please send /start to begin a new request.');
      }
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

  const handleSendReply = async () => {
    if (!session?.dbId) {
      alert('Session ID is missing.');
      return;
    }

    const messageText = replyText.trim();

    if (!messageText) {
      alert('Please enter a reply.');
      return;
    }

    try {
      setSendingReply(true);

      const { data, error } = await supabase.functions.invoke(
        'send-facebook-reply',
        {
          body: {
            sessionId: session.dbId,
            text: messageText,
            senderId:
              localStorage.getItem('currentAgentId') ||
              'agent_dashboard',
            senderName:
              localStorage.getItem('currentUserName') ||
              'Support Agent',
          },
        },
      );

      if (error) {
        console.error('send-facebook-reply invoke error:', error);
        throw error;
      }

      if (!data?.ok) {
        throw new Error(
          data?.error ||
            'Facebook Messenger delivery failed.',
        );
      }

      setReplyText('');

      await loadSession({
        showLoading: false,
      });
    } catch (error) {
      console.error('Failed to send Facebook reply:', error);

      alert(
        error?.message ||
          'Failed to send Facebook reply.',
      );
    } finally {
      setSendingReply(false);
    }
  };

  const stopRecordingStream = () => {
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  // Prefer OGG/Opus so the Telegram bridge can use sendVoice (native voice-note
  // UI). Fall back to webm/opus, which is what Chrome ships by default — the
  // edge function will then send it via sendAudio.
  const pickRecorderMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return null;
    const candidates = [
      'audio/ogg;codecs=opus',
      'audio/webm;codecs=opus',
      'audio/webm',
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  };

  const handleStartRecording = async () => {
    if (!isTelegramMode || session?.status === 'Ended') return;
    if (isRecording || sendingVoice) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const chunks = recordedChunksRef.current;
        recordedChunksRef.current = [];
        const startedAt = recordingStartedAtRef.current;
        const durationSeconds = startedAt
          ? Math.max(1, Math.round((Date.now() - startedAt) / 1000))
          : null;
        stopRecordingStream();
        setIsRecording(false);
        setRecordingSeconds(0);

        if (!chunks.length || !session?.dbId) return;

              const blobType =
        recorder.mimeType ||
        mimeType ||
        'audio/webm';

      const recordedBlob = new Blob(
        chunks,
        {
          type: blobType,
        },
      );

      try {
        setSendingVoice(true);

        const convertedBlob =
          await convertVoiceToOgg(
            recordedBlob,
          );

        await sendAgentVoiceReply({
          sessionId: session.dbId,

          agentId:
            localStorage.getItem(
              'currentAgentId',
            ) || null,

          agentName:
            localStorage.getItem(
              'currentUserName',
            ) || 'Agent',

          blob: convertedBlob,

          mimeType: 'audio/ogg',

          durationSeconds,
        });

        await loadSession({
          showLoading: false,
        });
      } catch (error) {
        console.error(
          'Failed to convert or send voice reply:',
          error,
        );

        alert(
          error?.message ||
            'Failed to send voice message.',
        );
      } finally {
        setSendingVoice(false);
      }
      };

      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        const startedAt = recordingStartedAtRef.current;
        if (startedAt) {
          setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000));
        }
      }, 1000);
    } catch (error) {
      console.error('Microphone access failed:', error);
      stopRecordingStream();
      setIsRecording(false);
      alert('Microphone access was denied or unavailable.');
    }
  };

  const handleStopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const handleCancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    // Tell the onstop handler to discard by clearing the chunks first.
    recordedChunksRef.current = [];
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // ignore
        }
      }
      stopRecordingStream();
    };
  }, []);

  const handleReplyKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendReply();
    }
  };

  const getSessionTimerLabel = (currentSession) => {
    const expiresAt = currentSession?.expiresAt;
    if (!expiresAt || currentSession.status !== 'Active') {
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

  const selectedTimer = getSessionTimerLabel(session);

  // Agent-side transcript hides the 2-minute inactivity warning. That message
  // is a nudge for the customer ("you have 2 minutes to respond") — the agent
  // can already see the countdown badge in the header, so showing it in the
  // chat just clutters their view.
  const isCustomerOnlySystemMessage = (message) => {
    const metaType = message?.metadata?.type;
    return metaType === 'timeout_warning';
  };

  const visibleTelegramMessages = telegramMessages.filter(
    (message) => !isCustomerOnlySystemMessage(message),
  );

  const conversationMessages = isTelegramMode
    ? visibleTelegramMessages
    : visibleTelegramMessages.length > 0
      ? visibleTelegramMessages
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
      ) : accessDenied ? (
        <div className="rounded-[28px] border border-red-100 bg-red-50/60 p-10 text-center shadow-[0_14px_40px_rgba(0,0,0,0.035)]">
          <h2 className="text-lg font-semibold text-red-700">
            You don't have access to this session
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-red-700/80">
            This session is assigned to another agent. Ask an admin if you need
            to be reassigned, then reopen the link.
          </p>

          <button
            type="button"
            onClick={() => navigate(fromPath)}
            className="mt-5 rounded-2xl bg-[#43acd6] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2389b8]"
          >
            Back to {fromLabel}
          </button>
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
            <div className="flex flex-col gap-5 px-4 py-5 lg:flex-row lg:items-center lg:justify-between sm:px-5">
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
                  <button
                    type="button"
                    onClick={() => setProfileOpen(true)}
                    title="View customer profile"
                    className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eef9fd] text-[#2389b8] ring-1 ring-[#43acd6]/15 transition hover:scale-105 hover:ring-2 hover:ring-[#43acd6]/30"
                  >
                    {session.avatarUrl ? (
                      <img
                        src={session.avatarUrl}
                        alt={session.customer}
                        className="h-full w-full object-cover"
                      />
                    ) : isTelegramMode ? (
                      <Bot size={20} />
                    ) : (
                      <MessageCircle size={20} />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <button
                        type="button"
                        onClick={() => setProfileOpen(true)}
                        title={session.customer}
                        className="max-w-45 truncate text-left text-lg font-semibold tracking-[-0.02em] text-[#1d1d1f] transition hover:text-[#2389b8] sm:max-w-md"
                      >
                        {session.customer}
                      </button>

                      <SessionBadge status={session.status} />
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#8e8e93]">
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
                <>
                {selectedTimer && session.status === 'Active' && (
                  <div
                    className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium ring-1 ${
                      selectedTimer.warning
                        ? 'bg-amber-50 text-amber-700 ring-amber-100'
                        : 'bg-[#f5f5f7] text-[#6e6e73] ring-black/6'
                    }`}
                  >
                    <Clock size={16} />
                    {selectedTimer.text}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 lg:mt-0">
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
                </>
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

          <div className="grid gap-5 lg:h-[calc(100vh-280px)] lg:min-h-150 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="flex min-h-155 flex-col overflow-hidden rounded-[28px] border border-black/6 bg-white/90 shadow-[0_14px_40px_rgba(0,0,0,0.035)] lg:min-h-0">
              <div className="border-b border-black/6 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
                    <MessageCircle size={18} />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-[#1d1d1f] sm:text-base">
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

                    // Image-only rendering: resolveImageAttachment checks
                    // both attachment_url (widget) and telegram-style
                    // metadata.photo_url / image_url etc., and verifies it's
                    // actually an image (extension/mime/kind). Non-image
                    // attachments (PDFs, voice notes, stickers, documents)
                    // intentionally don't render — we just show a small hint
                    // that something arrived so the agent can ask the
                    // customer to resend as an image.
                    const imageUrl = resolveImageAttachment(message);
                    const voiceAttachment = resolveVoiceAttachment(message);
                    const rawAttachmentUrl = getAnyAttachmentUrl(message);
                    const hasNonImageAttachment =
                      !imageUrl && !voiceAttachment && Boolean(rawAttachmentUrl);
                    const placeholderText = String(message.content || '').trim();
                    const isPlaceholderText =
                      placeholderText === '[Image]' ||
                      placeholderText === '[Voice message]' ||
                      placeholderText === '[Audio]';
                    const showContentText =
                      Boolean(message.content) && !isPlaceholderText;

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
                          {showContentText && (
                            <div className="whitespace-pre-wrap text-sm leading-6">
                              {message.content}
                            </div>
                          )}

                          {imageUrl && (
                            <img
                              src={imageUrl}
                              alt="Customer attachment"
                              onClick={() => setLightboxUrl(imageUrl)}
                              className={`max-h-64 max-w-full cursor-zoom-in rounded-2xl object-cover transition hover:opacity-90 ${
                                showContentText ? 'mt-2' : ''
                              }`}
                            />
                          )}

                          {voiceAttachment && (
                            <div className={showContentText ? 'mt-2' : ''}>
                              <VoiceMessageBubble
                            url={voiceAttachment.url}
                            bucket={voiceAttachment.bucket}
                            storagePath={voiceAttachment.storagePath}
                            durationSec={voiceAttachment.durationSec}
                            variant={isAgent ? 'agent' : 'customer'}
                          />
                            </div>
                          )}

                          {hasNonImageAttachment && (
                            <div
                              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                                showContentText ? 'mt-2' : ''
                              } ${
                                isAgent
                                  ? 'bg-white/15 text-blue-50'
                                  : 'bg-[#f5f5f7] text-[#6e6e73]'
                              }`}
                              title="Non-image attachment — ask the customer to resend as a picture"
                            >
                              📎 Attachment (image only — file ignored)
                            </div>
                          )}

                          <div
                            className={`mt-2 text-xs ${
                              isAgent ? 'text-blue-50' : 'text-[#8e8e93]'
                            }`}
                          >
                            {isAgent
                              ? message.metadata?.agentName || 'Agent'
                              : session.customer}{' '}
                            · {formatMessageTime(message.created_at, 'N/A')}
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
                      {isRecording ? (
                        <div className="flex h-11 flex-1 items-center gap-3 rounded-2xl bg-white px-3 ring-1 ring-red-100">
                          <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                          </span>

                          <div className="flex flex-1 items-center gap-0.75">
                            {Array.from({ length: 22 }).map((_, i) => (
                              <span
                                key={i}
                                className="w-[2.5px] animate-pulse rounded-full bg-red-400"
                                style={{
                                  height: `${30 + ((i * 47) % 60)}%`,
                                  animationDelay: `${i * 70}ms`,
                                  animationDuration: '900ms',
                                }}
                              />
                            ))}
                          </div>

                          <span className="shrink-0 text-xs font-medium tabular-nums text-red-600">
                            {formatVoiceDuration(recordingSeconds)}
                          </span>

                          <button
                            type="button"
                            onClick={handleCancelRecording}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8e8e93] transition hover:bg-red-50 hover:text-red-600"
                            title="Cancel recording"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ) : (
                        <textarea
                          id="replyText"
                          name="replyText"
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
                      )}

                      {isTelegramMode && (
                        <button
                          type="button"
                          onClick={isRecording ? handleStopRecording : handleStartRecording}
                          disabled={sendingVoice}
                          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                            isRecording
                              ? 'bg-red-500 text-white shadow-[0_14px_28px_rgba(239,68,68,0.25)] hover:bg-red-600'
                              : 'bg-white text-[#1d1d1f] ring-1 ring-black/6 hover:bg-[#fafafa] hover:text-[#43acd6]'
                          }`}
                          title={isRecording ? 'Stop and send voice' : 'Record voice message'}
                        >
                          {isRecording ? <Square size={14} fill="currentColor" /> : <Mic size={18} />}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleSendReply}
                        disabled={sendingReply || sendingVoice || isRecording || !replyText.trim()}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#43acd6] text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:bg-[#2389b8] disabled:cursor-not-allowed disabled:opacity-60"
                        title="Send reply"
                      >
                        <SendHorizontal size={18} />
                      </button>
                    </div>

                    <p className="mt-2 text-xs text-[#8e8e93]">
                      {isRecording
                        ? `Recording… ${formatVoiceDuration(recordingSeconds)}. Tap the stop button to send.`
                        : sendingVoice
                        ? 'Sending voice message…'
                        : isTelegramMode
                        ? 'Type a reply, or tap the mic to send a voice note. Messages are delivered on Telegram.'
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

            <aside className="max-h-[calc(100vh-280px)] space-y-4 overflow-y-auto pr-1 lg:max-h-full">
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

                  {/* Telegram sessions surface the username; Website Chatbot
                      sessions surface the email the customer entered in the
                      pre-chat form (or 'Not provided' if they didn't). */}
                  {isTelegramMode ? (
                    <SideInfo
                      icon={Bot}
                      label="Telegram"
                      value={session.telegram || 'Not provided'}
                    />
                  ) : (
                    <SideInfo
                      icon={Mail}
                      label="Email"
                      value={session.email || 'Not provided'}
                    />
                  )}
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

      {profileOpen && session && (
        <CustomerProfileModal
          session={session}
          isTelegram={isTelegramMode}
          onClose={() => setProfileOpen(false)}
        />
      )}

      {/* Fullscreen lightbox for customer image attachments. Click anywhere to dismiss. */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Attachment full size"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain"
          />
        </div>
      )}
    </DashboardLayout>
  );
};

const CustomerProfileModal = ({ session, isTelegram, onClose }) => {
  const raw = session.raw || {};
  const meta = raw.metadata || {};
  const customer = raw.customers || {};

  const telegramHandle =
    meta.telegramUsername ||
    meta.telegram_username ||
    customer.telegram_username ||
    null;

  const telegramChatId =
    meta.telegramChatId ||
    meta.telegram_chat_id ||
    meta.telegram_user_id ||
    raw.user_id ||
    null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-[28px] border border-black/6 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
      >
        <div className="relative bg-linear-to-br from-[#43acd6] to-[#2389b8] px-6 py-8 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
            aria-label="Close profile"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white/15 ring-2 ring-white/30">
              {session.avatarUrl ? (
                <img
                  src={session.avatarUrl}
                  alt={session.customer}
                  className="h-full w-full object-cover"
                />
              ) : isTelegram ? (
                <Bot size={36} />
              ) : (
                <UserRound size={36} />
              )}
            </div>

            <div className="text-center">
              <div className="text-lg font-semibold tracking-[-0.01em]">
                {session.customer || 'Unknown customer'}
              </div>
              {telegramHandle && (
                <div className="mt-1 text-sm text-white/85">
                  @{String(telegramHandle).replace(/^@/, '')}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 p-5">
          {telegramHandle && (
            <ProfileRow icon={AtSign} label="Telegram" value={`@${String(telegramHandle).replace(/^@/, '')}`} />
          )}
          {telegramChatId && (
            <ProfileRow icon={Hash} label="Telegram Chat ID" value={String(telegramChatId)} />
          )}
          {session.phone && (
            <ProfileRow icon={Phone} label="Phone" value={session.phone} />
          )}
          {(customer.email || meta.email) && (
            <ProfileRow icon={Mail} label="Email" value={customer.email || meta.email} />
          )}
          {(customer.ta_coin_user_id || meta.accountId) && (
            <ProfileRow icon={IdCard} label="T.A Coin ID" value={customer.ta_coin_user_id || meta.accountId} />
          )}
          {!telegramHandle && !telegramChatId && !session.phone && !customer.email && (
            <p className="rounded-2xl bg-[#f5f5f7] p-3 text-center text-sm text-[#6e6e73]">
              No additional profile details provided.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const ProfileRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-black/6 bg-[#fbfbfd] px-4 py-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef9fd] text-[#2389b8]">
      <Icon size={16} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[11px] font-medium uppercase tracking-wide text-[#8e8e93]">
        {label}
      </div>
      <div title={value} className="mt-0.5 truncate text-sm font-medium text-[#1d1d1f]">
        {value}
      </div>
    </div>
  </div>
);

// Resolve a renderable image URL from a chat_messages row, regardless of
// which producer wrote it. The widget puts it on `attachment_url`; the
// Telegram bot often puts it on metadata.photo_url / metadata.image_url etc.
// Then verify the candidate is actually an image — we explicitly want to
// IGNORE non-image attachments (PDFs, voice notes, stickers, documents) so
// they don't get rendered with a broken <img> tag. Caller can still surface
// a "non-image attachment" hint by checking the raw URL separately.

const resolveImageAttachment = (message) => {
  if (!message) return null;

  // DEBUG: Print exactly what the database row looks like
  console.log('Inspecting message from DB:', { 
    content: message.content, 
    attachment_url: message.attachment_url, 
    metadata: message.metadata 
  });

  const meta =
    message.metadata && typeof message.metadata === 'object'
      ? message.metadata
      : {};

  const url =
    message.attachment_url ||
    meta.attachment_url ||
    meta.photo_url ||
    meta.photoUrl ||
    meta.image_url ||
    meta.imageUrl ||
    meta.file_url ||
    meta.fileUrl ||
    meta.url ||
    null;

  if (!url) return null;

  const mimeType = String(
    meta.mime_type || meta.mimeType || meta.contentType || '',
  ).toLowerCase();
  
  const kind = String(
    meta.attachment_type || meta.attachmentType || meta.type || meta.kind || '',
  ).toLowerCase();

  const fileName = String(
    meta.file_name || meta.fileName || meta.name || ''
  ).toLowerCase();

  // If we have a MIME type and it's definitively NOT an image, reject immediately.
  // (octet-stream is a common generic fallback, so we allow it to pass through to the other checks)
  if (mimeType && !mimeType.startsWith('image/') && mimeType !== 'application/octet-stream') {
    return null;
  }

  // Explicitly reject known unsupported image/video types even if they slipped through
  if (/\.(gif|webp|bmp|svg|mp4|mov|avi|pdf|doc|docx|zip|rar|mp3|wav|ogg)(?:\?|#|$)/i.test(url) || /\.(gif|webp|bmp|svg|mp4|mov|avi|pdf|doc|docx|zip|rar|mp3|wav|ogg)$/i.test(fileName)) {
    return null;
  }
  if (/^image\/(gif|webp|bmp|svg\+xml)$/i.test(mimeType)) {
    return null;
  }

  // 1. Check for explicit PNG or JPG markers in URL
  if (/\.(png|jpe?g)(?:\?|#|$)/i.test(url)) return url;
  // 2. Check for explicit PNG or JPG in original filename (often present for uncompressed Telegram documents)
  if (/\.(png|jpe?g)$/i.test(fileName)) return url;
  // 3. Check MIME type (accommodate image/jpg as well as image/jpeg)
  if (/^image\/(png|jpeg|jpg)$/i.test(mimeType)) return url;

  // 4. Fallback: Telegram's "photo" array attachments are natively JPEG compressed by Telegram.
  // If it arrived explicitly as a photo or image, it is safe to render.
  const isImageKind = ['photo', 'image', 'picture', 'img'].some((token) => kind.includes(token));
  if (isImageKind) {
    return url;
  }

  // 5. Last Resort: If it has NO file extension at all (common for Supabase storage uploads) 
  // and isn't explicitly flagged as a document/video/audio, assume it's a valid image.
  const hasNoExtension = !/\.[a-zA-Z0-9]{2,5}(?:\?|#|$)/.test(url) && !/\.[a-zA-Z0-9]{2,5}$/.test(fileName);
  const isExplicitDocument = ['document', 'file', 'audio', 'voice', 'video'].some((token) => kind.includes(token));
  if (hasNoExtension && !isExplicitDocument) {
    return url;
  }

  return null;
};

const formatVoiceDuration = (totalSeconds) => {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Deterministic pseudo-waveform from a URL hash, so the same voice message
// always renders the same bar pattern across re-mounts (no jitter on rerender).
// Decoding the real audio would be more faithful but adds a heavy AudioContext
// per bubble — every social-media client uses a fake/pre-baked waveform.
const VOICE_BAR_COUNT = 34;

const generateWaveformHeights = (seed = '') => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  const heights = [];
  for (let i = 0; i < VOICE_BAR_COUNT; i++) {
    const x = Math.sin((hash >>> 0) + i * 12.9898) * 43758.5453;
    const frac = x - Math.floor(x);
    // Bias toward a "talking" envelope: ramp up, body, taper off.
    const t = i / (VOICE_BAR_COUNT - 1);
    const envelope = Math.sin(Math.PI * t) * 0.6 + 0.4;
    const value = 0.25 + Math.abs(frac) * 0.75 * envelope;
    heights.push(Math.max(0.2, Math.min(1, value)));
  }
  return heights;
};

// Standardised voice-message bubble. Mirrors WhatsApp / Telegram / Messenger:
// circular play/pause, pseudo-waveform bars that fill as playback advances,
// click-to-seek along the waveform, and a tabular-numeric timer that shows
// elapsed time while playing and the total duration when stopped.
const VoiceMessageBubble = ({
  url,
  bucket,
  storagePath,
  durationSec,
  variant = 'customer',
}) => {
  const audioRef = useRef(null);
  const waveRef = useRef(null);

  const [playableUrl, setPlayableUrl] = useState(url || '');
  const [urlLoading, setUrlLoading] = useState(Boolean(storagePath));
  const [urlError, setUrlError] = useState('');

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const [duration, setDuration] = useState(
    Number.isFinite(durationSec) && durationSec > 0
      ? Number(durationSec)
      : 0,
  );

  useEffect(() => {
    let cancelled = false;

    const resolvePlayableUrl = async () => {
      setUrlError('');

      if (!storagePath) {
        setPlayableUrl(url || '');
        setUrlLoading(false);
        return;
      }

      try {
        setUrlLoading(true);

        const { data, error } = await supabase.storage
          .from(bucket || 'voice-messages')
          .createSignedUrl(storagePath, 3600);

        if (error) throw error;

        if (!cancelled) {
          setPlayableUrl(data?.signedUrl || '');
        }
      } catch (error) {
        console.error('Failed to create signed voice URL:', error);

        if (!cancelled) {
          setPlayableUrl('');
          setUrlError('Voice message is unavailable.');
        }
      } finally {
        if (!cancelled) {
          setUrlLoading(false);
        }
      }
    };

    resolvePlayableUrl();

    return () => {
      cancelled = true;
    };
  }, [bucket, storagePath, url]);

  const heights = useMemo(
    () =>
      generateWaveformHeights(
        storagePath || playableUrl || url || '',
      ),
    [storagePath, playableUrl, url],
  );

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !playableUrl) return undefined;

    const onLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }

      setIsLoading(false);
    };

    const onTime = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnd = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => setIsLoading(false);

    const onError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      setUrlError('Unable to play this voice message.');
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('durationchange', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('durationchange', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('error', onError);
    };
  }, [playableUrl]);

  const togglePlay = async () => {
    const audio = audioRef.current;

    if (!audio || !playableUrl || urlLoading) return;

    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (error) {
      console.error('Failed to play voice message:', error);
      setIsPlaying(false);
      setUrlError('Unable to play this voice message.');
    }
  };

  const handleSeek = (event) => {
    const audio = audioRef.current;
    const wave = waveRef.current;

    if (!audio || !wave || !duration) return;

    const rect = wave.getBoundingClientRect();

    const clientX =
      event.clientX ??
      event.touches?.[0]?.clientX ??
      0;

    const ratio = Math.max(
      0,
      Math.min(1, (clientX - rect.left) / rect.width),
    );

    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  const isAgentBubble = variant === 'agent';

  const progress =
    duration > 0
      ? Math.min(1, currentTime / duration)
      : 0;

  const timerText = formatVoiceDuration(
    isPlaying || currentTime > 0
      ? currentTime
      : duration,
  );

  if (urlError) {
    return (
      <div
        className={`rounded-2xl px-3 py-2 text-xs ${
          isAgentBubble
            ? 'bg-white/15 text-blue-50'
            : 'bg-red-50 text-red-700'
        }`}
      >
        {urlError}
      </div>
    );
  }

  return (
    <div
      className={`flex min-w-57.5 max-w-[320px] items-center gap-3 rounded-2xl px-2.5 py-2 ${
        isAgentBubble
          ? 'bg-white/15'
          : 'bg-[#f0f4f8]'
      }`}
    >
      <button
        type="button"
        onClick={togglePlay}
        disabled={urlLoading || !playableUrl}
        title={isPlaying ? 'Pause' : 'Play'}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
          isAgentBubble
            ? 'bg-white text-[#2389b8] hover:bg-white/90'
            : 'bg-[#43acd6] text-white hover:bg-[#2389b8]'
        }`}
      >
        {urlLoading || isLoading ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : isPlaying ? (
          <Pause size={15} fill="currentColor" />
        ) : (
          <Play
            size={15}
            fill="currentColor"
            className="translate-x-px"
          />
        )}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div
          ref={waveRef}
          onClick={handleSeek}
          className="flex h-8 flex-1 cursor-pointer items-center gap-0.5"
          role="slider"
          tabIndex={0}
          aria-label="Voice message progress"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration) || 0}
          aria-valuenow={Math.round(currentTime)}
        >
          {heights.map((height, index) => {
            const barPosition =
              (index + 0.5) / VOICE_BAR_COUNT;

            const isActive =
              barPosition <= progress;

            const activeColor = isAgentBubble
              ? 'bg-white'
              : 'bg-[#43acd6]';

            const idleColor = isAgentBubble
              ? 'bg-white/45'
              : 'bg-[#43acd6]/30';

            return (
              <span
                key={index}
                className={`w-[2.5px] rounded-full transition-colors duration-150 ${
                  isActive ? activeColor : idleColor
                }`}
                style={{
                  height: `${Math.round(height * 100)}%`,
                }}
              />
            );
          })}
        </div>

        <span
          className={`shrink-0 text-[11px] font-medium tabular-nums ${
            isAgentBubble
              ? 'text-blue-50'
              : 'text-[#6e6e73]'
          }`}
        >
          {timerText}
        </span>
      </div>

      {playableUrl && (
        <audio
          key={playableUrl}
          ref={audioRef}
          src={playableUrl}
          preload="metadata"
          className="hidden"
        />
      )}
    </div>
  );
};

// Returns the raw (possibly non-image) attachment URL so we can still surface
// a small "Customer sent a file" badge instead of silently dropping the
// signal. Image attachments fall through resolveImageAttachment first.
const getAnyAttachmentUrl = (message) => {
  if (!message) return null;
  const meta =
    message.metadata && typeof message.metadata === 'object'
      ? message.metadata
      : {};
  return (
    message.attachment_url ||
    meta.attachment_url ||
    meta.file_url ||
    meta.fileUrl ||
    meta.url ||
    null
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

export default FacebookSessionWorkspacePage;