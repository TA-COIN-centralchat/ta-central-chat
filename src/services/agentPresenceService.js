import { supabase } from './supabaseClient';

const HEARTBEAT_INTERVAL_MS = 30000;

let heartbeatTimer = null;

export const markAgentOnline = async ({
  agentId,
  fullName,
  email,
  role,
}) => {
  if (!agentId) return null;

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('agent_presence')
    .upsert(
      {
        agent_id: agentId,
        full_name: fullName || null,
        email: email || null,
        role: role || null,
        presence_status: 'Online',
        agent_status: 'Available',
        last_seen_at: now,
        logged_in_at: now,
        logged_out_at: null,
        updated_at: now,
      },
      {
        onConflict: 'agent_id',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Failed to mark agent online:', error);
    throw error;
  }

  return data;
};

export const updateAgentHeartbeat = async (agentId) => {
  if (!agentId) return null;

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('agent_presence')
    .update({
      presence_status: 'Online',
      last_seen_at: now,
      updated_at: now,
    })
    .eq('agent_id', agentId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update agent heartbeat:', error);
    return null;
  }

  return data;
};

export const markAgentOffline = async (agentId) => {
  if (!agentId) return null;

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('agent_presence')
    .update({
      presence_status: 'Offline',
      agent_status: 'Offline',
      logged_out_at: now,
      updated_at: now,
    })
    .eq('agent_id', agentId)
    .select()
    .single();

  if (error) {
    console.error('Failed to mark agent offline:', error);
    return null;
  }

  return data;
};

export const startAgentHeartbeat = (agentId) => {
  if (!agentId) return;

  stopAgentHeartbeat();

  updateAgentHeartbeat(agentId);

  heartbeatTimer = window.setInterval(() => {
    updateAgentHeartbeat(agentId);
  }, HEARTBEAT_INTERVAL_MS);
};

export const stopAgentHeartbeat = () => {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

export const setAgentAvailability = async (agentId, status) => {
  if (!agentId) return null;

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('agent_presence')
    .update({
      agent_status: status,
      updated_at: now,
    })
    .eq('agent_id', agentId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update agent availability:', error);
    throw error;
  }

  return data;
};

export const getMyPresence = async (agentId) => {
  if (!agentId) return null;

  const { data, error } = await supabase
    .from('agent_presence')
    .select('*')
    .eq('agent_id', agentId)
    .maybeSingle();

  if (error) {
    console.error('Failed to get agent presence:', error);
    return null;
  }

  return data;
};