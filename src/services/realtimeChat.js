import { supabase } from "./supabaseClient";

/**
 * Supabase Realtime Chat Service
 * Uses:
 * - chat_sessions  (id, user_id, status, agent_id, created_at, updated_at, metadata)
 * - chat_messages  (id, session_id, sender_role, sender_id, content, created_at, metadata)
 */

const SESSION_DURATION_MINUTES = 20;
const WARNING_MINUTES_BEFORE_END = 5;
const MAX_ACTIVE_SESSIONS_PER_AGENT = 5;

const WARNING_MESSAGE =
  "Dear customer, do you have any other questions? This chat session will automatically end in 2 minutes if there is no response.";

const AUTO_END_MESSAGE =
  "This chat session has ended due to inactivity. If you need more help, please start a new chat.";

const getCurrentUserRole = () => {
  return localStorage.getItem("currentUserRole");
};

const getCurrentAgentId = () => {
  return localStorage.getItem("currentAgentId");
};

const isAdmin = () => {
  return getCurrentUserRole() === "Admin";
};

const isCustomerServiceAgent = () => {
  return getCurrentUserRole() === "Customer Service Agent";
};

const getExpiryIso = () => {
  return new Date(
    Date.now() + SESSION_DURATION_MINUTES * 60 * 1000,
  ).toISOString();
};

// eslint-disable-next-line no-unused-vars
const normalizeStatus = (status = "") => {
  const value = String(status).toLowerCase().trim();

  if (value === "waiting" || value === "new") return "waiting";
  if (value === "active" || value === "assigned" || value === "in progress") {
    return "active";
  }
  if (value === "closed" || value === "ended" || value === "timeout") {
    return "closed";
  }

  return value || "waiting";
};

const logSupabaseError = (label, error) => {
  console.error(label, {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
  });
};

const getSessionMetadata = (session) => {
  return session?.metadata && typeof session.metadata === "object"
    ? session.metadata
    : {};
};

const refreshSessionTimerMetadata = (sessionMetadata = {}) => {
  return {
    ...sessionMetadata,
    expiresAt: getExpiryIso(),
    warningSentAt: null,
    lastActivityAt: new Date().toISOString(),
  };
};

const findAvailableAgentForSession = async () => {
  const { data: agents, error: agentError } = await supabase
    .from("agents")
    .select("id, full_name, email, role, status")
    .eq("status", "Available");

  if (agentError) {
    logSupabaseError("Error finding available live chat agent:", agentError);
    throw agentError;
  }

  if (!agents || agents.length === 0) {
    return null;
  }

  const { data: activeSessions, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("id, agent_id, status")
    .eq("status", "active")
    .not("agent_id", "is", null);

  if (sessionError) {
    logSupabaseError("Error checking active chat sessions:", sessionError);
    throw sessionError;
  }

  const agentsWithActiveCount = agents.map((agent) => {
    const activeSessionCount = (activeSessions || []).filter(
      (session) => session.agent_id === agent.id,
    ).length;

    return {
      ...agent,
      activeSessionCount,
    };
  });

  const eligibleAgents = agentsWithActiveCount.filter(
    (agent) => agent.activeSessionCount < MAX_ACTIVE_SESSIONS_PER_AGENT,
  );

  if (eligibleAgents.length === 0) {
    return null;
  }

  const lowestCount = Math.min(
    ...eligibleAgents.map((agent) => agent.activeSessionCount),
  );

  const lowestAgents = eligibleAgents.filter(
    (agent) => agent.activeSessionCount === lowestCount,
  );

  return lowestAgents[Math.floor(Math.random() * lowestAgents.length)];
};

export async function autoAssignWaitingChatSessions() {
  const { data: waitingSessions, error: waitingError } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("status", "waiting")
    .is("agent_id", null)
    .order("created_at", { ascending: true });

  if (waitingError) {
    logSupabaseError("Error loading waiting chat sessions:", waitingError);
    throw waitingError;
  }

  if (!waitingSessions || waitingSessions.length === 0) {
    return {
      assignedCount: 0,
      message: "No waiting chat sessions.",
    };
  }

  const { data: availableAgents, error: agentError } = await supabase
    .from("agents")
    .select("id, full_name, email, status")
    .eq("status", "Available");

  if (agentError) {
    logSupabaseError("Error loading available agents for chats:", agentError);
    throw agentError;
  }

  if (!availableAgents || availableAgents.length === 0) {
    return {
      assignedCount: 0,
      message: "No available agents for waiting chat sessions.",
    };
  }

  const { data: activeSessions, error: activeError } = await supabase
    .from("chat_sessions")
    .select("id, agent_id")
    .eq("status", "active")
    .not("agent_id", "is", null);

  if (activeError) {
    logSupabaseError("Error loading active chat sessions:", activeError);
    throw activeError;
  }

  const agentPool = availableAgents.map((agent) => {
    const activeSessionCount = (activeSessions || []).filter(
      (session) => session.agent_id === agent.id,
    ).length;

    return {
      ...agent,
      activeSessionCount,
    };
  });

  let assignedCount = 0;

  for (const waitingSession of waitingSessions) {
    const eligibleAgents = agentPool.filter(
      (agent) => agent.activeSessionCount < MAX_ACTIVE_SESSIONS_PER_AGENT,
    );

    if (eligibleAgents.length === 0) {
      break;
    }

    const lowestCount = Math.min(
      ...eligibleAgents.map((agent) => agent.activeSessionCount),
    );

    const lowestAgents = eligibleAgents.filter(
      (agent) => agent.activeSessionCount === lowestCount,
    );

    const selectedAgent =
      lowestAgents[Math.floor(Math.random() * lowestAgents.length)];

    const existingMetadata = getSessionMetadata(waitingSession);

    const { error: assignError } = await supabase
      .from("chat_sessions")
      .update({
        status: "active",
        agent_id: selectedAgent.id,
        updated_at: new Date().toISOString(),
        metadata: refreshSessionTimerMetadata({
          ...existingMetadata,
          autoAssigned: true,
          assignedAgentName: selectedAgent.full_name,
          assignedAgentEmail: selectedAgent.email,
          reassignedFromQueue: true,
        }),
      })
      .eq("id", waitingSession.id)
      .eq("status", "waiting")
      .is("agent_id", null);

    if (assignError) {
      logSupabaseError(
        "Error auto-assigning waiting chat session:",
        assignError,
      );
      continue;
    }

    await supabase.from("chat_messages").insert({
      session_id: waitingSession.id,
      sender_role: "system",
      sender_id: "system",
      content: `You are now connected with ${selectedAgent.full_name}.`,
      metadata: {
        type: "auto_assigned_from_queue",
        agentId: selectedAgent.id,
        agentName: selectedAgent.full_name,
      },
    });

    const poolIndex = agentPool.findIndex(
      (agent) => agent.id === selectedAgent.id,
    );
    if (poolIndex !== -1) {
      agentPool[poolIndex].activeSessionCount += 1;
    }

    assignedCount += 1;
  }

  return {
    assignedCount,
    message: `${assignedCount} waiting chat session(s) auto-assigned.`,
  };
}

// ─── Session Management ───────────────────────────────────────────

/**
 * Claim a waiting session manually by an agent.
 */
export async function claimSession(sessionId, agentId) {
  let agentName = "Agent";
  let agentEmail = null;

  try {
    const { data: agentData } = await supabase
      .from("agents")
      .select("full_name, email")
      .eq("id", agentId)
      .single();
    
    if (agentData) {
      agentName = agentData.full_name;
      agentEmail = agentData.email;
    }
  } catch (e) {
    // Ignore error if agent is not in db
  }

  const { data: existingSession, error: sessionReadError } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionReadError) throw sessionReadError;

  const existingMetadata = getSessionMetadata(existingSession);

  const { data, error } = await supabase
    .from("chat_sessions")
    .update({
      status: "active",
      agent_id: agentId,
      updated_at: new Date().toISOString(),
      metadata: refreshSessionTimerMetadata({
        ...existingMetadata,
        assignedAgentName: agentName,
        assignedAgentEmail: agentEmail,
        claimedManually: true,
      }),
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new chat session for a user requesting agent support.
 * Auto-assigns to an available agent if possible.
 */
export async function createChatSession(userId, metadata = {}) {
  const selectedAgent = await findAvailableAgentForSession();

  const sessionMetadata = {
    ...metadata,
    autoAssigned: Boolean(selectedAgent),
    assignedAgentName: selectedAgent?.full_name || null,
    assignedAgentEmail: selectedAgent?.email || null,
    expiresAt: selectedAgent ? getExpiryIso() : null,
    warningSentAt: null,
    lastActivityAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      user_id: userId,
      status: selectedAgent ? "active" : "waiting",
      agent_id: selectedAgent?.id || null,
      metadata: sessionMetadata,
    })
    .select()
    .single();

  if (error) throw error;

  if (selectedAgent) {
    await supabase.from("chat_messages").insert({
      session_id: data.id,
      sender_role: "system",
      sender_id: "system",
      content: `You are now connected with ${selectedAgent.full_name}.`,
      metadata: {
        type: "auto_assigned",
        agentId: selectedAgent.id,
        agentName: selectedAgent.full_name,
      },
    });
  } else {
    await supabase.from("chat_messages").insert({
      session_id: data.id,
      sender_role: "system",
      sender_id: "system",
      content:
        "Thank you for contacting us. All agents are currently busy, but someone will assist you shortly.",
      metadata: {
        type: "waiting_queue",
      },
    });
  }

  return data;
}

/**
 * Close a chat session.
 */
export async function closeSession(sessionId) {
  const { data: existingSession, error: existingError } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (existingError) throw existingError;

  const existingMetadata = getSessionMetadata(existingSession);

  const { data, error } = await supabase
    .from("chat_sessions")
    .update({
      status: "closed",
      updated_at: new Date().toISOString(),
      metadata: {
        ...existingMetadata,
        endedAt: new Date().toISOString(),
        endedReason: "closed_by_agent",
      },
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all waiting/active sessions.
 * Admin sees all.
 * Customer Service Agent sees waiting + own active sessions.
 * Other agents see own sessions only.
 */
export async function getActiveSessions() {
  const currentAgentId = getCurrentAgentId();

  let query = supabase
    .from("chat_sessions")
    .select("*")
    .in("status", ["waiting", "active"])
    .order("created_at", { ascending: true });

  if (getCurrentUserRole() && !isAdmin()) {
    if (!currentAgentId) return [];

    if (isCustomerServiceAgent()) {
      query = query.or(`agent_id.eq.${currentAgentId},agent_id.is.null`);
    } else {
      query = query.eq("agent_id", currentAgentId);
    }
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Get a single session by ID.
 */
export async function getSessionById(sessionId) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) throw error;
  return data;
}

// ─── Message Management ───────────────────────────────────────────

/**
 * Send a message in a chat session.
 */
export async function sendMessage(
  sessionId,
  senderRole,
  senderId,
  content,
  metadata = {},
) {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      session_id: sessionId,
      sender_role: senderRole,
      sender_id: senderId,
      content,
      metadata,
    })
    .select()
    .single();

  if (error) throw error;

  const shouldRefreshTimer =
    senderRole === "user" ||
    senderRole === "customer" ||
    senderRole === "agent";

  const { data: existingSession, error: sessionReadError } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!sessionReadError && existingSession) {
    const existingMetadata = getSessionMetadata(existingSession);

    const updatedMetadata = shouldRefreshTimer
      ? refreshSessionTimerMetadata(existingMetadata)
      : existingMetadata;

    await supabase
      .from("chat_sessions")
      .update({
        updated_at: new Date().toISOString(),
        metadata: updatedMetadata,
      })
      .eq("id", sessionId);
  } else {
    await supabase
      .from("chat_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", sessionId);
  }

  return data;
}

/**
 * Get all messages for a session.
 */
export async function getSessionMessages(sessionId) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Check active sessions and send 2-minute warning / auto-close.
 * This can run from LiveChatPage every 30 seconds.
 */
export async function processChatSessionTimeouts() {
  const now = new Date();

  const { data: sessions, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("status", "active");

  if (error) {
    logSupabaseError("Error loading active sessions for timeout check:", error);
    throw error;
  }

  for (const session of sessions || []) {
    const metadata = getSessionMetadata(session);
    const expiresAtValue = metadata.expiresAt;

    if (!expiresAtValue) continue;

    const expiresAt = new Date(expiresAtValue);
    const remainingMs = expiresAt.getTime() - now.getTime();

    if (remainingMs <= 0) {
      const endedMetadata = {
        ...metadata,
        endedAt: now.toISOString(),
        endedReason: "inactivity_timeout",
      };

      await supabase
        .from("chat_sessions")
        .update({
          status: "closed",
          updated_at: now.toISOString(),
          metadata: endedMetadata,
        })
        .eq("id", session.id);

      await supabase.from("chat_messages").insert({
        session_id: session.id,
        sender_role: "system",
        sender_id: "system",
        content: AUTO_END_MESSAGE,
        metadata: {
          type: "auto_end",
        },
      });

      continue;
    }

    const warningThresholdMs = WARNING_MINUTES_BEFORE_END * 60 * 1000;
    const warningAlreadySent = Boolean(metadata.warningSentAt);

    if (remainingMs <= warningThresholdMs && !warningAlreadySent) {
      await supabase.from("chat_messages").insert({
        session_id: session.id,
        sender_role: "system",
        sender_id: "system",
        content: WARNING_MESSAGE,
        metadata: {
          type: "timeout_warning",
        },
      });

      await supabase
        .from("chat_sessions")
        .update({
          updated_at: now.toISOString(),
          metadata: {
            ...metadata,
            warningSentAt: now.toISOString(),
          },
        })
        .eq("id", session.id);
    }
  }
}

// ─── Realtime Subscriptions ───────────────────────────────────────

/**
 * Subscribe to new messages in a specific session.
 */
export function subscribeToSessionMessages(sessionId, onMessage) {
  const channel = supabase
    .channel(`chat-messages-${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        onMessage(payload.new);
      },
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
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "chat_sessions",
        filter: `id=eq.${sessionId}`,
      },
      (payload) => {
        onStatusChange(payload.new);
      },
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to all session changes.
 */
export function subscribeToAllSessions(onSessionChange) {
  const channel = supabase
    .channel("agent-dashboard-sessions")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "chat_sessions",
      },
      (payload) => {
        onSessionChange(payload.eventType, payload.new, payload.old);
      },
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to realtime changes on the messages table for ticket ChatWindow.
 */
export function subscribeToTicketMessages(ticketId, onMessage) {
  const channel = supabase
    .channel(`ticket-messages-${ticketId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `ticket_id=eq.${ticketId}`,
      },
      (payload) => {
        onMessage(payload.new);
      },
    )
    .subscribe();

  return channel;
}

// ─── Utility ──────────────────────────────────────────────────────

export function getOrCreateUserId() {
  let userId = localStorage.getItem("tacoin_chat_user_id");

  if (!userId) {
    userId = "user_" + crypto.randomUUID();
    localStorage.setItem("tacoin_chat_user_id", userId);
  }

  return userId;
}

export function getOrCreateAgentId() {
  const loggedInAgentId = localStorage.getItem("currentAgentId");

  if (loggedInAgentId) {
    return loggedInAgentId;
  }

  let agentId = localStorage.getItem("tacoin_agent_id");

  if (!agentId) {
    agentId = "agent_" + crypto.randomUUID();
    localStorage.setItem("tacoin_agent_id", agentId);
  }

  return agentId;
}
