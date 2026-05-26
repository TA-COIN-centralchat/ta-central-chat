import { supabase } from './supabase';

/**
 * Supabase Realtime Chat Service
 * Replaces the WebSocket-based agent-server.js with Supabase Realtime channels.
 * No separate server needed and supports auto-assignment.
 */

const MAX_ACTIVE_SESSIONS_PER_AGENT = 5;

const findAvailableAgentForSession = async () => {
  const { data: agents, error: agentError } = await supabase
    .from('agents')
    .select('id, full_name, email, role, status')
    .eq('status', 'Available');

  if (agentError) throw agentError;
  if (!agents || agents.length === 0) return null;

  const { data: activeSessions, error: activeError } = await supabase
    .from('chat_sessions')
    .select('id, agent_id')
    .eq('status', 'active')
    .not('agent_id', 'is', null);

  if (activeError) throw activeError;

  const agentsWithCount = agents.map((agent) => ({
    ...agent,
    activeSessionCount: (activeSessions || []).filter(
      (session) => session.agent_id === agent.id
    ).length,
  }));

  const eligibleAgents = agentsWithCount.filter(
    (agent) => agent.activeSessionCount < MAX_ACTIVE_SESSIONS_PER_AGENT
  );

  if (eligibleAgents.length === 0) return null;

  const lowestCount = Math.min(
    ...eligibleAgents.map((agent) => agent.activeSessionCount)
  );

  const lowestAgents = eligibleAgents.filter(
    (agent) => agent.activeSessionCount === lowestCount
  );

  return lowestAgents[Math.floor(Math.random() * lowestAgents.length)];
};

/**
 * Create a new chat session for a user requesting agent support.
 * Auto-assigns immediately when an available agent exists.
 */
export async function createChatSession(userId, metadata = {}) {
  const selectedAgent = await findAvailableAgentForSession();

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      status: selectedAgent ? 'active' : 'waiting',
      agent_id: selectedAgent?.id || null,
      metadata: {
        ...metadata,
        autoAssigned: Boolean(selectedAgent),
        assignedAgentName: selectedAgent?.full_name || null,
        assignedAgentEmail: selectedAgent?.email || null,
      },
    })
    .select()
    .single();

  if (error) throw error;

  if (selectedAgent) {
    await supabase.from('chat_messages').insert({
      session_id: data.id,
      sender_role: 'system',
      sender_id: 'system',
      content: `You are now connected with ${selectedAgent.full_name}.`,
      metadata: {
        type: 'auto_assigned',
        agentId: selectedAgent.id,
        agentName: selectedAgent.full_name,
      },
    });
  } else {
    await supabase.from('chat_messages').insert({
      session_id: data.id,
      sender_role: 'system',
      sender_id: 'system',
      content:
        'Thank you for contacting us. All agents are currently busy, but someone will assist you shortly.',
      metadata: {
        type: 'waiting_queue',
      },
    });
  }

  return data;
}

/**
 * Close a chat session.
 */
export async function closeSession(sessionId) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .update({ status: 'closed' })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all waiting/active sessions (for agent dashboard).
 */
export async function getActiveSessions() {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .in('status', ['waiting', 'active'])
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Send a message in a chat session.
 */
export async function sendMessage(sessionId, senderRole, senderId, content) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      sender_role: senderRole,
      sender_id: senderId,
      content,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all messages for a session.
 */
export async function getSessionMessages(sessionId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Subscribe to new messages in a specific session (for both user and agent).
 */
export function subscribeToSessionMessages(sessionId, onMessage) {
  const channel = supabase
    .channel(`chat-messages-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        onMessage(payload.new);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to session status changes.
 */
export function subscribeToSessionStatus(sessionId, onStatusChange) {
  const channel = supabase
    .channel(`chat-session-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_sessions',
        filter: `id=eq.${sessionId}`,
      },
      (payload) => {
        onStatusChange(payload.new);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to all session changes.
 */
export function subscribeToAllSessions(onSessionChange) {
  const channel = supabase
    .channel('agent-dashboard-sessions')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_sessions',
      },
      (payload) => {
        onSessionChange(payload.eventType, payload.new, payload.old);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Presence channel for typing indicators.
 */
export function createPresenceChannel(sessionId, userId, role) {
  const channel = supabase.channel(`presence-${sessionId}`, {
    config: { presence: { key: userId } },
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user_id: userId,
        role,
        online_at: new Date().toISOString(),
      });
    }
  });

  return channel;
}

/**
 * Generate a unique anonymous user ID.
 */
export function getOrCreateUserId() {
  let userId = localStorage.getItem('tacoin_chat_user_id');
  if (!userId) {
    userId = `user_${crypto.randomUUID()}`;
    localStorage.setItem('tacoin_chat_user_id', userId);
  }
  return userId;
}

/**
 * Generate a unique agent ID.
 */
export function getOrCreateAgentId() {
  let agentId = localStorage.getItem('tacoin_agent_id');
  if (!agentId) {
    agentId = `agent_${crypto.randomUUID()}`;
    localStorage.setItem('tacoin_agent_id', agentId);
  }
  return agentId;
}
