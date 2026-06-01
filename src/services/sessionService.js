import { supabase } from './supabaseClient';

// Migrated from the legacy public.sessions table to public.chat_sessions.
// Status values are stored lowercase to match the landing-page chatbot
// ('waiting' | 'active' | 'closed'). The UI label mapping happens in mapSession.

const MAX_ACTIVE_SESSIONS_PER_AGENT = 5;

const SUPPORT_AGENT_ROLES = [
  'Customer Service Agent',
  'Customer Support Agent',
];

const SESSION_SELECT = `
  *,
  customers (
    id,
    full_name,
    phone,
    email,
    telegram_username,
    ta_coin_user_id
  ),
  tickets (
    id,
    ticket_number,
    status,
    issue_type
  ),
  agents:assigned_agent_id (
    id,
    full_name,
    email,
    role,
    status
  )
`;

/* =========================
   Helpers
========================= */

const getCurrentUserRole = () => localStorage.getItem('currentUserRole');
const getCurrentAgentId = () => localStorage.getItem('currentAgentId');
const getCurrentUserName = () => localStorage.getItem('currentUserName') || 'Agent';

const isAdmin = () => getCurrentUserRole() === 'Admin';
const isCustomerServiceAgent = () => getCurrentUserRole() === 'Customer Service Agent';

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

const mapSession = (session) => {
  const meta = session.metadata || {};
  const telegramHandle = meta.telegramUsername
    ? `@${meta.telegramUsername}`
    : meta.telegramChatId || '';

  return {
    dbId: session.id,
    id: session.session_number || session.id,

    customerId: session.customer_id,
    customer:
      session.customers?.full_name ||
      meta.customerName ||
      meta.fullName ||
      session.user_id ||
      'Unknown Customer',
    phone: session.customers?.phone || meta.phone || '',
    telegram: session.customers?.telegram_username
      ? `@${session.customers.telegram_username}`
      : telegramHandle,
    email: session.customers?.email || meta.email || '',
    accountId: session.customers?.ta_coin_user_id || '',

    channel: session.channel || meta.channel || '-',
    status: toStatusLabel(session.status),

    assignedAgentId: session.assigned_agent_id || null,
    assignedAgentName:
      session.agents?.full_name ||
      session.assigned_agent_name ||
      meta.assignedAgentName ||
      'Unassigned',

    lastMessage:
      session.last_message ||
      meta.issueDescription ||
      'No message yet.',
    issueType: meta.issueType || '',
    issueDescription: meta.issueDescription || '',
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

/* =========================
   Auto Assignment Helper
========================= */

const findAvailableAgentForSession = async () => {
  const { data: agents, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('status', 'Available')
    .in('role', SUPPORT_AGENT_ROLES)
    .order('active_tickets', { ascending: true });

  if (agentError) {
    logSupabaseError('Error finding available live chat agent:', agentError);
    throw agentError;
  }

  if (!agents || agents.length === 0) return null;

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
  const currentAgentId = getCurrentAgentId();
  const currentUserRole = getCurrentUserRole();

  let query = supabase
    .from('chat_sessions')
    .select(SESSION_SELECT)
    .order('created_at', { ascending: false });

  if (currentUserRole !== 'Admin') {
    if (!currentAgentId) return [];
    query = query.eq('assigned_agent_id', currentAgentId);
  }

  const { data, error } = await query;

  if (error) {
    logSupabaseError('Error fetching sessions:', error);
    throw error;
  }

  return (data || []).map(mapSession);
};

export const getSessionById = async (sessionId) => {
  const currentAgentId = getCurrentAgentId();
  const currentUserRole = getCurrentUserRole();

  const { data, error } = await supabase
    .from('chat_sessions')
    .select(SESSION_SELECT)
    .eq('id', sessionId)
    .single();

  if (error) {
    logSupabaseError('Error fetching session:', error);
    throw error;
  }

  if (currentUserRole !== 'Admin') {
    const isAssignedToMe = data.assigned_agent_id === currentAgentId;
    const status = String(data.status || '').toLowerCase();
    const isWaiting =
      !data.assigned_agent_id ||
      status === 'waiting' ||
      status === 'new';

    if (!isAssignedToMe && !(isCustomerServiceAgent() && isWaiting)) {
      throw new Error('You do not have permission to view this session.');
    }
  }

  return mapSession(data);
};

export const getSessionsByChannel = async (channel) => {
  const currentAgentId = getCurrentAgentId();
  const currentUserRole = getCurrentUserRole();

  let query = supabase
    .from('chat_sessions')
    .select(SESSION_SELECT)
    .eq('channel', channel)
    .order('created_at', { ascending: false });

  if (currentUserRole !== 'Admin') {
    if (!currentAgentId) {
      console.warn('Missing currentAgentId. Returning empty channel sessions.');
      return [];
    }
    query = query.eq('assigned_agent_id', currentAgentId);
  }

  const { data, error } = await query;

  if (error) {
    logSupabaseError(`Error fetching ${channel} sessions:`, error);
    throw error;
  }

  return (data || []).map(mapSession);
};

export const getWaitingSessions = async () => {
  const currentAgentId = getCurrentAgentId();

  let query = supabase
    .from('chat_sessions')
    .select(SESSION_SELECT)
    .or('assigned_agent_id.is.null,status.eq.waiting')
    .order('created_at', { ascending: true });

  if (!isAdmin() && !isCustomerServiceAgent()) {
    if (!currentAgentId) return [];
    query = query.eq('assigned_agent_id', currentAgentId);
  }

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
   Assignment
========================= */

export const assignSessionToCurrentAgent = async (sessionId) => {
  const currentAgentId = getCurrentAgentId();
  const currentUserName = getCurrentUserName();

  if (!currentAgentId) {
    throw new Error('Missing current agent ID.');
  }

  const { data: existingSession, error: checkError } = await supabase
    .from('chat_sessions')
    .select('id, assigned_agent_id, status')
    .eq('id', sessionId)
    .single();

  if (checkError) {
    logSupabaseError('Error checking session before assignment:', checkError);
    throw checkError;
  }

  if (
    existingSession.assigned_agent_id &&
    existingSession.assigned_agent_id !== currentAgentId &&
    !isAdmin()
  ) {
    throw new Error('This session is already assigned to another agent.');
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .update({
      assigned_agent_id: currentAgentId,
      assigned_agent_name: currentUserName,
      agent_id: String(currentAgentId),
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    logSupabaseError('Error assigning session:', error);
    throw error;
  }

  await createAuditLog({
    userName: currentUserName,
    role: getCurrentUserRole() || 'Agent',
    action: 'Session Assigned',
    details: `Session assigned to ${currentUserName}.`,
  });

  return data;
};

/* =========================
   Status / Replies / Rating
========================= */

export const updateSessionStatus = async ({
  sessionId,
  status,
  auditDetails,
}) => {
  const currentAgentId = getCurrentAgentId();

  if (!isAdmin()) {
    const { data: existingSession, error: checkError } = await supabase
      .from('chat_sessions')
      .select('id, assigned_agent_id')
      .eq('id', sessionId)
      .single();

    if (checkError) {
      logSupabaseError('Error checking session permission:', checkError);
      throw checkError;
    }

    if (existingSession.assigned_agent_id !== currentAgentId) {
      throw new Error('You do not have permission to update this session.');
    }
  }

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

export const sendSessionReply = async ({ sessionId, messageText }) => {
  const currentAgentId = getCurrentAgentId();

  if (!isAdmin()) {
    const { data: existingSession, error: checkError } = await supabase
      .from('chat_sessions')
      .select('id, assigned_agent_id')
      .eq('id', sessionId)
      .single();

    if (checkError) {
      logSupabaseError('Error checking reply permission:', checkError);
      throw checkError;
    }

    if (existingSession.assigned_agent_id !== currentAgentId) {
      throw new Error('You must assign this session to yourself before replying.');
    }
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .update({
      last_message: messageText,
      status: 'active',
      last_agent_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
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
