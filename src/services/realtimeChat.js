import { supabase } from "./supabaseClient";
import { buildSessionTimerWrite } from "./sessionService";
import { matchesChannel } from "../utils/channel";

/**
 * Supabase Realtime Chat Service
 * Uses:
 * - chat_sessions  (id, user_id, status, assigned_agent_id, created_at, updated_at, metadata)
 * - chat_messages  (id, session_id, sender_role, sender_id, content, created_at, metadata)
 */

const WARNING_MINUTES_BEFORE_END = 2;

// Cross-channel cap: an agent can be assigned to at most this many *active*
// chat sessions across Telegram + Website Chatbot combined. Once they hit the
// cap, new sessions fall into the waiting queue until one of theirs closes.
const MAX_ACTIVE_SESSIONS_PER_AGENT = 5;

// Allow-list of roles eligible for auto-assignment. Admins are intentionally
// excluded — they have view-all access but never carry a session load. Any
// agent with a role outside this list (or a NULL role) is also skipped.
const SUPPORT_AGENT_ROLES = [
  "Customer Service Agent",
  "Customer Support Agent",
];

const WARNING_MESSAGE =
  "Dear customer, do you have any other questions? This chat session will automatically end in 2 minutes if there is no response.";

const AUTO_END_MESSAGE =
  "This chat session has ended due to inactivity. If you need more help, please start a new chat.";

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


const findAvailableAgentForSession = async () => {
  const { data: agents, error: agentError } = await supabase
    .from("agents")
    .select("id, full_name, email, role, status")
    .eq("status", "Available")
    .in("role", SUPPORT_AGENT_ROLES);

  if (agentError) {
    logSupabaseError("Error finding available live chat agent:", agentError);
    throw agentError;
  }

  if (!agents || agents.length === 0) {
    return null;
  }

  // Counts every active session regardless of channel, so Telegram + Live Chat
  // share the same MAX_ACTIVE_SESSIONS_PER_AGENT bucket.
  const { data: activeSessions, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("id, assigned_agent_id, status")
    .eq("status", "active")
    .not("assigned_agent_id", "is", null);

  if (sessionError) {
    logSupabaseError("Error checking active chat sessions:", sessionError);
    throw sessionError;
  }

  const agentsWithActiveCount = agents.map((agent) => {
    const activeSessionCount = (activeSessions || []).filter(
      (session) => session.assigned_agent_id === agent.id,
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
    .is("assigned_agent_id", null)
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
    .select("id, full_name, email, role, status")
    .eq("status", "Available")
    .in("role", SUPPORT_AGENT_ROLES);

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
    .select("id, assigned_agent_id")
    .eq("status", "active")
    .not("assigned_agent_id", "is", null);

  if (activeError) {
    logSupabaseError("Error loading active chat sessions:", activeError);
    throw activeError;
  }

  const agentPool = availableAgents.map((agent) => {
    const activeSessionCount = (activeSessions || []).filter(
      (session) => session.assigned_agent_id === agent.id,
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
        assigned_agent_id: selectedAgent.id,
        assigned_agent_name: selectedAgent.full_name,
        updated_at: new Date().toISOString(),
        // Stamp the timer on both the real columns and the metadata mirror.
        ...buildSessionTimerWrite({
          ...existingMetadata,
          autoAssigned: true,
          assignedAgentName: selectedAgent.full_name,
          assignedAgentEmail: selectedAgent.email,
          reassignedFromQueue: true,
        }),
      })
      .eq("id", waitingSession.id)
      .eq("status", "waiting")
      .is("assigned_agent_id", null);

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
 * Create a new chat session for a user requesting agent support.
 * Auto-assigns to an available agent if possible.
 */
export async function createChatSession(userId, metadata = {}) {
  const selectedAgent = await findAvailableAgentForSession();

  const baseMetadata = {
    ...metadata,
    autoAssigned: Boolean(selectedAgent),
    assignedAgentName: selectedAgent?.full_name || null,
    assignedAgentEmail: selectedAgent?.email || null,
  };

  // Waiting sessions have no timer until an agent picks them up; active
  // sessions get the standard 20-minute window written to both the real
  // expires_at column and metadata.expiresAt mirror.
  const timerWrite = selectedAgent
    ? buildSessionTimerWrite(baseMetadata)
    : { expires_at: null, warning_sent_at: null, metadata: baseMetadata };

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      user_id: userId,
      status: selectedAgent ? "active" : "waiting",
      assigned_agent_id: selectedAgent?.id || null,
      assigned_agent_name: selectedAgent?.full_name || null,
      ...timerWrite,
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
 * Get waiting/active/closed sessions, optionally scoped to one agent.
 *
 * `assignedAgentId` is the access-control knob:
 *   - omitted / null  → return everything (admin view)
 *   - a UUID          → return only sessions where assigned_agent_id matches
 *
 * Pass the current agent's id for non-admin callers so they only see their
 * own sessions. Channel filtering still happens client-side because some
 * legacy rows have channel=null with only metadata signals.
 */
export async function getActiveSessions(channel = null, { assignedAgentId } = {}) {
  let query = supabase
    .from("chat_sessions")
    .select("*")
    .in("status", ["waiting", "active", "closed"])
    .order("created_at", { ascending: true });

  if (assignedAgentId) {
    // Match either the new assigned_agent_id column or the legacy agent_id
    // text column — the Telegram bot may still be writing to the legacy one.
    query = query.or(
      `assigned_agent_id.eq.${assignedAgentId},agent_id.eq.${assignedAgentId}`,
    );
  }

  const { data, error } = await query;

  if (error) throw error;
  if (!channel) return data || [];

  return (data || []).filter((session) => matchesChannel(session, channel));
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
    const nowIso = new Date().toISOString();

    // Refresh timer on real columns + metadata when a customer or agent
    // sends a message. System messages don't refresh the inactivity timer.
    const timerWrite = shouldRefreshTimer
      ? buildSessionTimerWrite(existingMetadata)
      : { metadata: existingMetadata };

    // Stamp the side-specific activity column so reporting/analytics can
    // distinguish customer vs agent activity without scanning chat_messages.
    const sideStamp = {};
    if (senderRole === "user" || senderRole === "customer") {
      sideStamp.last_customer_message_at = nowIso;
    } else if (senderRole === "agent") {
      sideStamp.last_agent_message_at = nowIso;
    }

    await supabase
      .from("chat_sessions")
      .update({
        updated_at: nowIso,
        ...timerWrite,
        ...sideStamp,
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
    // Prefer the first-class expires_at column; fall back to metadata for
    // any pre-migration rows whose real column is still null.
    const expiresAtValue = session.expires_at || metadata.expiresAt;

    if (!expiresAtValue) continue;

    const expiresAt = new Date(expiresAtValue);
    const remainingMs = expiresAt.getTime() - now.getTime();

    if (remainingMs <= 0) {
      const endedMetadata = {
        ...metadata,
        endedAt: now.toISOString(),
        endedReason: "inactivity_timeout",
      };

      // Atomic close: only mark closed if expires_at is still in the past at
      // write time. If the customer or agent just sent a message and refreshed
      // the timer, the row won't match and we skip the close.
      const { data: closedRows, error: closeError } = await supabase
        .from("chat_sessions")
        .update({
          status: "closed",
          ended_at: now.toISOString(),
          updated_at: now.toISOString(),
          metadata: endedMetadata,
        })
        .eq("id", session.id)
        .eq("status", "active")
        .lte("expires_at", now.toISOString())
        .select("id");

      if (closeError) {
        logSupabaseError("Error closing inactive session:", closeError);
        continue;
      }

      if (!closedRows || closedRows.length === 0) {
        // Another writer refreshed expires_at — session is still active.
        continue;
      }

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
    // Prefer real column, fall back to metadata mirror.
    const warningAlreadySent = Boolean(
      session.warning_sent_at || metadata.warningSentAt,
    );

    if (remainingMs <= warningThresholdMs && !warningAlreadySent) {
      const warningWindowEnd = new Date(
        now.getTime() + warningThresholdMs,
      ).toISOString();

      // Atomic mark-as-warned. Conditions:
      //   - status still 'active' (someone may have closed it in flight)
      //   - real warning_sent_at column is still null
      //   - metadata.warningSentAt mirror is still null (catches transitional
      //     rows where the real column was never populated pre-migration)
      //   - expires_at is still inside the warning window
      // Postgres serializes concurrent UPDATEs on the same row, so even with
      // multiple sweeper instances running across tabs, only one wins and
      // the others get 0 rows returned.
      const { data: warnedRows, error: warningUpdateError } = await supabase
        .from("chat_sessions")
        .update({
          warning_sent_at: now.toISOString(),
          updated_at: now.toISOString(),
          metadata: {
            ...metadata,
            warningSentAt: now.toISOString(),
          },
        })
        .eq("id", session.id)
        .eq("status", "active")
        .is("warning_sent_at", null)
        .is("metadata->>warningSentAt", null)
        .lte("expires_at", warningWindowEnd)
        .select("id");

      if (warningUpdateError) {
        logSupabaseError(
          "Error marking timeout warning as sent:",
          warningUpdateError,
        );
        continue;
      }

      if (!warnedRows || warnedRows.length === 0) {
        // Timer was refreshed in flight — no warning needed.
        continue;
      }

      await supabase.from("chat_messages").insert({
        session_id: session.id,
        sender_role: "system",
        sender_id: "system",
        content: WARNING_MESSAGE,
        metadata: {
          type: "timeout_warning",
        },
      });
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
 * Subscribe to session changes for a specific channel.
 */
export function subscribeToChannelSessions(channelName, onSessionChange) {
  const channel = supabase
    .channel(`channel-sessions-${channelName.toLowerCase().replace(/\s+/g, "-")}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "chat_sessions",
        filter: `channel=eq.${channelName}`,
      },
      (payload) => {
        onSessionChange(payload.eventType, payload.new, payload.old);
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
