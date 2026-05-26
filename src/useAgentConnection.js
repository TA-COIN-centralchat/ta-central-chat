import { useCallback, useEffect, useState } from "react";
import { supabase } from "./services/supabaseClient";

const DEFAULT_AGENT_NAME = "Agent Dara";

const generateUserId = () => {
  const existingId = localStorage.getItem("ta_coin_agent_user_id");

  if (existingId) {
    return existingId;
  }

  const newId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  localStorage.setItem("ta_coin_agent_user_id", newId);

  return newId;
};

const formatMessage = (message) => {
  return {
    id: message.id,
    sessionId: message.session_id,
    senderType: message.sender_type,
    senderName: message.sender_name,
    messageText: message.message_text,
    createdAt: message.created_at,
    isAgent: message.sender_type === "agent",
  };
};

const useAgentConnection = (sessionId) => {
  const [userId] = useState(() => generateUserId());
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);

  const loadSession = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: sessionData, error: sessionError } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionError) {
        throw sessionError;
      }

      const { data: messageData, error: messageError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (messageError) {
        throw messageError;
      }

      setSession(sessionData);
      setMessages((messageData || []).map(formatMessage));
      setConnected(true);
    } catch (error) {
      console.error("Failed to load agent session:", error);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!sessionId) return undefined;

    const channel = supabase
      .channel(`agent-session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, formatMessage(payload.new)]);
        },
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const sendMessage = useCallback(
    async (messageText) => {
      if (!sessionId) {
        throw new Error("Missing session ID.");
      }

      if (!messageText?.trim()) {
        return null;
      }

      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          session_id: sessionId,
          sender_type: "agent",
          sender_name:
            localStorage.getItem("currentUserName") || DEFAULT_AGENT_NAME,
          message_text: messageText.trim(),
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to send agent message:", error);
        throw error;
      }

      return formatMessage(data);
    },
    [sessionId],
  );

  const updateSessionStatus = useCallback(
    async (status) => {
      if (!sessionId) {
        throw new Error("Missing session ID.");
      }

      const { data, error } = await supabase
        .from("sessions")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .select()
        .single();

      if (error) {
        console.error("Failed to update session status:", error);
        throw error;
      }

      setSession(data);
      return data;
    },
    [sessionId],
  );

  const assignSessionToMe = useCallback(async () => {
    if (!sessionId) {
      throw new Error("Missing session ID.");
    }

    const agentId = localStorage.getItem("currentAgentId");
    const agentName =
      localStorage.getItem("currentUserName") || DEFAULT_AGENT_NAME;

    const { data, error } = await supabase
      .from("sessions")
      .update({
        assigned_agent_id: agentId || null,
        assigned_agent_name: agentName,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (error) {
      console.error("Failed to assign session:", error);
      throw error;
    }

    setSession(data);
    return data;
  }, [sessionId]);

  return {
    connected,
    loading,
    messages,
    session,
    userId,
    sendMessage,
    updateSessionStatus,
    assignSessionToMe,
    reloadSession: loadSession,
  };
};

export default useAgentConnection;
