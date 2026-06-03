import { supabase } from './supabaseClient';
import { matchesChannel } from '../utils/channel';
import { parseSupportForm } from '../utils/supportForm';

// Migrated from the legacy public.sessions table to public.chat_sessions.
// Status values are stored lowercase to match the landing-page chatbot
// ('waiting' | 'active' | 'closed'). The UI label mapping happens in mapSession.

// Status values are stored lowercase to match the landing-page chatbot
// ('waiting' | 'active' | 'closed'). The UI label mapping happens in mapSession.

// Cross-channel session cap: an agent can carry at most this many *active*
// chat sessions across Telegram + Website Chatbot combined. Beyond this they
// stop receiving auto-assignments and new sessions go to the waiting queue.
const MAX_ACTIVE_SESSIONS_PER_AGENT = 5;

// Allow-list of roles eligible for auto-assignment. Admins are intentionally
// excluded — they can view every session but never carry session load.
const SUPPORT_AGENT_ROLES = [
  'Customer Service Agent',
  'Customer Support Agent',
];

const SESSION_DURATION_MINUTES = 20;


// PostgREST resource embedding requires declared FK constraints. The previous
// `customers(...)` and `agents:assigned_agent_id(...)` embeds were 400-ing on
// every query, which silently emptied every channel inbox. Use plain `*` and
// fall back to denormalized fields already on chat_sessions.
const SESSION_SELECT = '*';

/* =========================
   Helpers
========================= */

const getCurrentUserRole = () => localStorage.getItem('currentUserRole');
const getCurrentUserName = () => localStorage.getItem('currentUserName') || 'Agent';

const logSupabaseError = (label, error) => {
  console.error(label, {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
  });
};

const formatDateTime = (dateValue) => {
  if (!dateValue) return 'N/A';
  return new Date(dateValue).toLocaleString();
};

// Lowercase storage → capitalized UI labels
const STATUS_LABEL = {
  waiting: 'Waiting',
  active: 'Active',
  closed: 'Ended',
  ended: 'Ended',
  'idle warning': 'Idle Warning',
};

const toStatusLabel = (status) => {
  const key = String(status || '').toLowerCase();
  return STATUS_LABEL[key] || status || 'Waiting';
};

// UI status string → DB storage value
const STATUS_DB = {
  Waiting: 'waiting',
  Active: 'active',
  Ended: 'closed',
  Closed: 'closed',
  'Idle Warning': 'idle warning',
};

const toStatusDb = (status) => STATUS_DB[status] || String(status || '').toLowerCase();

// `firstUserMessageText` is optional — when present we mine it for the
// legacy support-form fields (customer name / email / phone / issue type)
// that pre-restructure widget builds packed into the first user message.
const mapSession = (session, firstUserMessageText = '') => {
  // Ensure metadata is always an object
  const metadata = session.metadata && typeof session.metadata === 'object'
    ? session.metadata
    : {};


  const meta = session.metadata || {};
  const telegramHandle = meta.telegramUsername
    ? `@${meta.telegramUsername}`
    : meta.telegramChatId || '';

  const fallback = parseSupportForm(firstUserMessageText);

  return {
    dbId: session.id,
    id: session.session_number || session.id,

    customerId: session.customer_id,
    customer:
      session.customers?.full_name ||
      meta.customerName ||
      meta.fullName ||
      fallback.customerName ||
      session.user_id ||
      'Unknown Customer',
    phone:
      session.customers?.phone ||
      meta.phone ||
      fallback.phone ||
      '',
    telegram: session.customers?.telegram_username
      ? `@${session.customers.telegram_username}`
      : telegramHandle,
    email:
      session.customers?.email ||
      meta.email ||
      fallback.email ||
      '',
    accountId: session.customers?.ta_coin_user_id || '',
    avatarUrl:
      meta.photoUrl ||
      meta.avatarUrl ||
      meta.photo_url ||
      session.customers?.photo_url ||
      '',

    // Prefer first-class timer columns, fall back to the metadata mirror for
    // any session row written before the migration.
    expiresAt: session.expires_at || metadata.expiresAt,
    warningSentAt: session.warning_sent_at || metadata.warningSentAt,

    channel: session.channel || meta.channel || '-',
    status: toStatusLabel(session.status),

    // Accept the legacy agent_id text column as a fallback — the Telegram
    // bot may still be writing there instead of assigned_agent_id.
    assignedAgentId: session.assigned_agent_id || session.agent_id || null,
    assignedAgentName:
      session.agents?.full_name ||
      session.assigned_agent_name ||
      meta.assignedAgentName ||
      'Unassigned',

    lastMessage:
      session.last_message ||
      meta.issueDescription ||
      'No message yet.',
    issueType: meta.issueType || fallback.issueType || '',
    issueDescription:
      meta.issueDescription || fallback.issueDescription || '',
    rating: session.rating,
    ratingComment: session.rating_comment || '',
    endedAt: session.ended_at,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    time: formatDateTime(session.created_at),

    linkedTickets: session.tickets || [],
    raw: session,
  };
};

const createAuditLog = async ({
  userName = 'System',
  role = 'System',
  action,
  details,
}) => {
  const { error } = await supabase.from('audit_logs').insert({
    user_name: userName,
    role,
    action,
    details,
  });

  if (error) {
    logSupabaseError('Error creating session audit log:', error);
  }
};

export const getExpiryIso = () => {
  return new Date(
    Date.now() + SESSION_DURATION_MINUTES * 60 * 1000,
  ).toISOString();
};

export const refreshSessionTimerMetadata = (sessionMetadata = {}) => {
  return {
    ...sessionMetadata,
    expiresAt: getExpiryIso(),
    warningSentAt: null,
    lastActivityAt: new Date().toISOString(),
  };
};

/**
 * Build an update payload that refreshes a session's inactivity timer in BOTH
 * the first-class columns (expires_at, warning_sent_at) and the legacy
 * metadata mirror. Spread the return value into any `.update()` payload.
 *
 *   await supabase.from('chat_sessions').update({
 *     ...buildSessionTimerWrite(existing.metadata),
 *     last_agent_message_at: nowIso,
 *   }).eq('id', sessionId);
 *
 * The metadata mirror is kept until every consumer reads real columns; once
 * that's done it can be dropped.
 */
export const buildSessionTimerWrite = (existingMetadata = {}) => {
  const expiry = getExpiryIso();
  return {
    expires_at: expiry,
    warning_sent_at: null,
    metadata: {
      ...existingMetadata,
      expiresAt: expiry,
      warningSentAt: null,
      lastActivityAt: new Date().toISOString(),
    },
  };
};

/* =========================
   Auto Assignment Helper
========================= */

const findAvailableAgentForSession = async () => {
  // active_tickets is a separate ticket-workload counter on the agents row;
  // we don't use it for session load — session counts are computed below from
  // the chat_sessions table directly so the cap is exact.
  const { data: agents, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('status', 'Available')
    .in('role', SUPPORT_AGENT_ROLES);

  if (agentError) {
    logSupabaseError('Error finding available live chat agent:', agentError);
    throw agentError;
  }

  if (!agents || agents.length === 0) return null;

  // Counts every active session regardless of channel, so Telegram + Live Chat
  // share the same MAX_ACTIVE_SESSIONS_PER_AGENT bucket.
  const { data: activeSessions, error: sessionError } = await supabase
    .from('chat_sessions')
    .select('id, assigned_agent_id, status')
    .eq('status', 'active')
    .not('assigned_agent_id', 'is', null);

  if (sessionError) {
    logSupabaseError('Error checking active agent sessions:', sessionError);
    throw sessionError;
  }

  const agentsWithSessionCount = agents.map((agent) => ({
    ...agent,
    activeSessionCount: (activeSessions || []).filter(
      (session) => session.assigned_agent_id === agent.id,
    ).length,
  }));

  const eligibleAgents = agentsWithSessionCount.filter(
    (agent) => agent.activeSessionCount < MAX_ACTIVE_SESSIONS_PER_AGENT,
  );

  if (eligibleAgents.length === 0) return null;

  const lowestWorkload = Math.min(
    ...eligibleAgents.map((agent) => agent.activeSessionCount),
  );

  const lowestAgents = eligibleAgents.filter(
    (agent) => agent.activeSessionCount === lowestWorkload,
  );

  return lowestAgents[Math.floor(Math.random() * lowestAgents.length)];
};

/* =========================
   Session Queries
========================= */

export const getSessions = async () => {
  let query = supabase
    .from('chat_sessions')
    .select(SESSION_SELECT)
    .order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    logSupabaseError('Error fetching sessions:', error);
    throw error;
  }

  return (data || []).map(mapSession);
};

export const getSessionById = async (sessionId) => {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select(SESSION_SELECT)
    .eq('id', sessionId)
    .single();

  if (error) {
    logSupabaseError('Error fetching session:', error);
    throw error;
  }

  // Fetch the first customer message so mapSession can mine it for the
  // legacy support-form fields. Non-fatal on error.
  let firstUserMessageText = '';
  const { data: firstMessageRows, error: messageError } = await supabase
    .from('chat_messages')
    .select('content')
    .eq('session_id', sessionId)
    .in('sender_role', ['user', 'customer'])
    .order('created_at', { ascending: true })
    .limit(1);

  if (messageError) {
    logSupabaseError(
      'Error fetching first customer message for session:',
      messageError,
    );
  } else if (firstMessageRows && firstMessageRows.length > 0) {
    firstUserMessageText = firstMessageRows[0].content || '';
  }

  return mapSession(data, firstUserMessageText);
};

export const getSessionsByChannel = async (
  channel,
  page = null,
  pageSize = 20,
  { assignedAgentId } = {},
) => {
  // Fetch a wide pool of recent sessions, then filter+paginate client-side.
  // Channel may live in column or metadata; legacy/bot-created rows can have
  // channel=null with telegram signals only in metadata, so DB-side filtering
  // would miss them.
  let query = supabase
    .from('chat_sessions')
    .select(SESSION_SELECT)
    .order('created_at', { ascending: false })
    .limit(500);

  // Access scoping: when an agent id is provided we restrict at the DB layer.
  // Admin callers omit this and get every row. Match either the new
  // assigned_agent_id column or the legacy agent_id text column — the
  // Telegram bot may still be writing to the legacy column.
  if (assignedAgentId) {
    query = query.or(
      `assigned_agent_id.eq.${assignedAgentId},agent_id.eq.${assignedAgentId}`,
    );
  }

  const { data, error } = await query;

  if (error) {
    logSupabaseError(`Error fetching ${channel} sessions:`, error);
    throw error;
  }

  const allRows = data || [];
  let filtered = allRows.filter((session) => matchesChannel(session, channel));

  // Diagnostic fallback: if the channel filter excluded every row, show the
  // full pool so the user at least sees the queue. This protects against
  // legacy/bot-created rows that lack any channel marker we recognize. We
  // skip the fallback for scoped (non-admin) calls so we don't accidentally
  // leak another agent's sessions in the recovery path.
  if (!assignedAgentId && filtered.length === 0 && allRows.length > 0) {
    console.warn(
      `[getSessionsByChannel] "${channel}" filter matched 0 of ${allRows.length} rows; falling back to showing all sessions.`,
    );
    filtered = allRows;
  }

  const paginated =
    page === null
      ? filtered
      : filtered.slice((page - 1) * pageSize, page * pageSize);

  // Batch-fetch the first customer message for the page so mapSession can
  // parse legacy support-form fields (customer name / email / phone / issue
  // type) for sessions that don't carry structured metadata yet. Single
  // round-trip across all page sessions, then we group client-side and keep
  // only the earliest per session.
  const pageSessionIds = paginated.map((s) => s.id);
  const firstMessageBySessionId = {};

  if (pageSessionIds.length > 0) {
    const { data: firstMessages, error: messageError } = await supabase
      .from('chat_messages')
      .select('session_id, content, created_at, sender_role')
      .in('session_id', pageSessionIds)
      .in('sender_role', ['user', 'customer'])
      .order('created_at', { ascending: true });

    if (messageError) {
      logSupabaseError(
        `Error fetching first customer messages for ${channel} sessions:`,
        messageError,
      );
      // Non-fatal — mapSession will just fall back to whatever metadata exists.
    } else {
      (firstMessages || []).forEach((row) => {
        if (!firstMessageBySessionId[row.session_id]) {
          firstMessageBySessionId[row.session_id] = row.content;
        }
      });
    }
  }

  return paginated.map((session) =>
    mapSession(session, firstMessageBySessionId[session.id] || ''),
  );
};

export const getWaitingSessions = async () => {
  let query = supabase
    .from('chat_sessions')
    .select(SESSION_SELECT)
    .or('assigned_agent_id.is.null,status.eq.waiting')
    .order('created_at', { ascending: true });

  const { data, error } = await query;

  if (error) {
    logSupabaseError('Error fetching waiting sessions:', error);
    throw error;
  }

  return (data || []).map(mapSession);
};

/* =========================
   Session Creation + Auto Assign
========================= */

export const createSession = async ({
  customerId,
  channel,
  lastMessage = '',
}) => {
  const sessionNumber = `SES-${Date.now()}`;
  const selectedAgent = await findAvailableAgentForSession();

  // Only stamp the inactivity timer for sessions that start in 'active' state.
  // Waiting-queue rows get expires_at = null and only get a timer once an
  // agent picks them up via autoAssignWaitingChatSessions.
  const baseMetadata = {
    autoAssigned: Boolean(selectedAgent),
    assignedAgentName: selectedAgent?.full_name || null,
    assignedAgentEmail: selectedAgent?.email || null,
    channel,
  };

  const timerWrite = selectedAgent
    ? buildSessionTimerWrite(baseMetadata)
    : { expires_at: null, warning_sent_at: null, metadata: baseMetadata };

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      session_number: sessionNumber,
      user_id: customerId ? String(customerId) : `agent-created-${Date.now()}`,
      customer_id: customerId || null,
      channel,
      status: selectedAgent ? 'active' : 'waiting',
      last_message: lastMessage || null,
      assigned_agent_id: selectedAgent?.id || null,
      assigned_agent_name: selectedAgent?.full_name || null,
      agent_id: selectedAgent?.id ? String(selectedAgent.id) : null,
      ...timerWrite,
    })
    .select()
    .single();

  if (error) {
    logSupabaseError('Error creating session:', error);
    throw error;
  }

  await createAuditLog({
    userName: 'System',
    role: 'System',
    action: selectedAgent
      ? 'Live Chat Session Auto Assigned'
      : 'Live Chat Session Added to Queue',
    details: selectedAgent
      ? `New ${channel} session ${sessionNumber} was auto-assigned to ${selectedAgent.full_name}.`
      : `New ${channel} session ${sessionNumber} was created but no available agent was found.`,
  });

  return {
    session: data,
    assignedAgent: selectedAgent,
  };
};

export const createTestSession = async (channel) => {
  const timestamp = Date.now();

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert({
      full_name: `Test Customer ${timestamp}`,
      phone: `010${String(timestamp).slice(-6)}`,
      telegram_username:
        channel === 'Telegram'
          ? `@test_customer_${String(timestamp).slice(-4)}`
          : null,
      email:
        channel === 'Website Chatbot'
          ? `test${String(timestamp).slice(-4)}@customer.com`
          : null,
      ta_coin_user_id: `TAU-${String(timestamp).slice(-5)}`,
      source_channel: channel,
    })
    .select()
    .single();

  if (customerError) {
    logSupabaseError('Error creating test customer:', customerError);
    throw customerError;
  }

  const testMessage =
    channel === 'Telegram'
      ? 'Hello, I need help with my T.A Coin account.'
      : 'Hi, I have a question about using the website chatbot.';

  return createSession({
    customerId: customer.id,
    channel,
    lastMessage: testMessage,
  });
};

/* =========================
   Status / Replies / Rating
========================= */

export const updateSessionStatus = async ({
  sessionId,
  status,
  auditDetails,
}) => {
  const dbStatus = toStatusDb(status);

  const updateData = {
    status: dbStatus,
    updated_at: new Date().toISOString(),
  };

  if (dbStatus === 'closed') {
    updateData.ended_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .update(updateData)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    logSupabaseError('Error updating session status:', error);
    throw error;
  }

  await createAuditLog({
    userName: getCurrentUserName(),
    role: getCurrentUserRole() || 'Agent',
    action: `Session Status Updated to ${status}`,
    details: auditDetails || `Session status changed to ${status}.`,
  });

  return data;
};

export const endSession = async (sessionId) =>
  updateSessionStatus({
    sessionId,
    status: 'Ended',
    auditDetails: 'Customer conversation session ended by agent.',
  });

export const sendSessionReply = async (args = {}) => {
  // Accept both naming styles used across call sites:
  // - { sessionId, messageText }
  // - { session_id, sender_role, sender_id, content, metadata }
  const sessionId = args.sessionId || args.session_id;
  const messageText = args.messageText || args.content;
  const senderRole = args.senderRole || args.sender_role || 'agent';
  const senderId = args.senderId || args.sender_id || null;
  const messageMetadata = args.metadata || {};

  if (!sessionId) {
    throw new Error('sendSessionReply: sessionId is required');
  }

  if (!messageText || !String(messageText).trim()) {
    throw new Error('sendSessionReply: message text is required');
  }

  // Insert into chat_messages so realtime subscribers (the agent dashboard, the
  // customer widget, the Telegram bridge) actually see the reply. Previously
  // this only touched chat_sessions.last_message, so messages never showed up
  // in the transcript.
  const { error: messageError } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      sender_role: senderRole,
      sender_id: senderId,
      content: messageText,
      metadata: messageMetadata,
    });

  if (messageError) {
    logSupabaseError('Error inserting session reply message:', messageError);
    throw messageError;
  }

  // Refresh timer metadata so the inactivity worker doesn't kill a session the
  // agent just replied to. Read existing metadata first to preserve unrelated
  // fields (assignedAgentName, channel, etc.).
  const { data: existingSession } = await supabase
    .from('chat_sessions')
    .select('metadata, status')
    .eq('id', sessionId)
    .single();

  const existingMetadata =
    existingSession?.metadata && typeof existingSession.metadata === 'object'
      ? existingSession.metadata
      : {};

  const nowIso = new Date().toISOString();
  const sessionUpdate = {
    last_message: messageText,
    last_agent_message_at: nowIso,
    updated_at: nowIso,
    // Refresh both first-class timer columns and the metadata mirror.
    ...buildSessionTimerWrite(existingMetadata),
  };

  // Don't accidentally reopen a closed session because someone hit send on
  // stale UI.
  if (existingSession?.status !== 'closed') {
    sessionUpdate.status = 'active';
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .update(sessionUpdate)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    logSupabaseError('Error sending session reply:', error);
    throw error;
  }

  await createAuditLog({
    userName: getCurrentUserName(),
    role: getCurrentUserRole() || 'Agent',
    action: 'Session Reply Sent',
    details: `Agent replied in session: ${messageText}`,
  });

  return data;
};

// Telegram-only: upload an agent-recorded voice blob to the voice-messages
// bucket, insert a chat_messages row, refresh the timer, then ask the
// send-telegram-reply Edge Function to deliver it to the customer on Telegram
// via sendVoice/sendAudio.
const VOICE_BUCKET = 'voice-messages';

export const sendAgentVoiceReply = async ({
  sessionId,
  agentId,
  agentName,
  blob,
  mimeType,
  durationSeconds,
}) => {
  if (!sessionId) throw new Error('sendAgentVoiceReply: sessionId is required');
  if (!blob) throw new Error('sendAgentVoiceReply: blob is required');

  const isOgg = String(mimeType || blob.type || '').toLowerCase().includes('ogg');
  const extension = isOgg ? 'oga' : 'webm';
  const fileName = `agent_${Date.now()}.${extension}`;
  const storagePath = `dashboard/${sessionId}/${fileName}`;
  const contentType = mimeType || blob.type || (isOgg ? 'audio/ogg' : 'audio/webm');

  const { error: uploadError } = await supabase.storage
    .from(VOICE_BUCKET)
    .upload(storagePath, blob, { contentType, upsert: false });

  if (uploadError) {
    logSupabaseError('Error uploading agent voice message:', uploadError);
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage
    .from(VOICE_BUCKET)
    .getPublicUrl(storagePath);

  const voiceUrl = publicUrlData.publicUrl;

  const messageMetadata = {
    source: 'dashboard',
    kind: 'voice',
    attachment_url: voiceUrl,
    mimeType: contentType,
    fileName,
    ...(agentName ? { agentName } : {}),
    ...(durationSeconds ? { duration: Math.round(durationSeconds) } : {}),
  };

  const { error: messageError } = await supabase.from('chat_messages').insert({
    session_id: sessionId,
    sender_role: 'agent',
    sender_id: agentId || null,
    content: '[Voice message]',
    attachment_url: voiceUrl,
    metadata: messageMetadata,
  });

  if (messageError) {
    logSupabaseError('Error inserting agent voice message:', messageError);
    throw messageError;
  }

  const { data: existingSession } = await supabase
    .from('chat_sessions')
    .select('metadata, status')
    .eq('id', sessionId)
    .single();

  const existingMetadata =
    existingSession?.metadata && typeof existingSession.metadata === 'object'
      ? existingSession.metadata
      : {};

  const nowIso = new Date().toISOString();
  const sessionUpdate = {
    last_message: '[Voice message]',
    last_agent_message_at: nowIso,
    updated_at: nowIso,
    ...buildSessionTimerWrite(existingMetadata),
  };

  if (existingSession?.status !== 'closed') {
    sessionUpdate.status = 'active';
  }

  const { error: sessionError } = await supabase
    .from('chat_sessions')
    .update(sessionUpdate)
    .eq('id', sessionId);

  if (sessionError) {
    logSupabaseError('Error updating session after voice reply:', sessionError);
    throw sessionError;
  }

  const { data: relayData, error: relayError } = await supabase.functions.invoke(
    'send-telegram-reply',
    {
      body: {
        sessionId,
        voiceUrl,
        mimeType: contentType,
        duration: durationSeconds ? Math.round(durationSeconds) : undefined,
      },
    },
  );

  if (relayError) {
    logSupabaseError('Error relaying agent voice to Telegram:', relayError);
    throw relayError;
  }
  if (relayData?.ok === false) {
    throw new Error(relayData?.error || 'Failed to deliver voice to Telegram.');
  }

  await createAuditLog({
    userName: getCurrentUserName(),
    role: getCurrentUserRole() || 'Agent',
    action: 'Session Voice Reply Sent',
    details: 'Agent sent a voice message in a Telegram session.',
  });

  return { voiceUrl };
};

export const submitSessionRating = async ({
  sessionId,
  rating,
  ratingComment,
}) => {
  const { data, error } = await supabase
    .from('chat_sessions')
    .update({
      rating,
      rating_comment: ratingComment || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    logSupabaseError('Error submitting session rating:', error);
    throw error;
  }

  await createAuditLog({
    userName: 'Customer',
    role: 'Customer',
    action: 'Session Rated',
    details: `Customer rated session ${rating}/5.`,
  });

  return data;
};
