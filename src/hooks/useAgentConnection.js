import { useEffect, useState, useCallback, useRef } from 'react';
import {
  createChatSession,
  sendMessage,
  getSessionMessages,
  subscribeToSessionMessages,
  subscribeToSessionStatus,
  getOrCreateUserId,
} from '../services/realtimeChat';

/**
 * Hook for user-side real-time agent chat via Supabase Realtime.
 * Replaces the old WebSocket-based connection entirely.
 */
export const useAgentConnection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [session, setSession] = useState(null);
  const [agentJoined, setAgentJoined] = useState(false);

  const messageSubRef = useRef(null);
  const statusSubRef = useRef(null);
  const userId = useRef(getOrCreateUserId());

  /**
   * Start a new agent chat session
   */
  const connectToAgent = useCallback(async (description = '') => {
    try {
      setIsWaiting(true);
      setMessages([]);
      setAgentJoined(false);

      // Create session in Supabase
      const newSession = await createChatSession(userId.current, {
        description,
        userAgent: navigator.userAgent,
        page: window.location.pathname,
      });

      setSession(newSession);

      // Send the initial description as first message
      if (description) {
        await sendMessage(newSession.id, 'user', userId.current, description);
      }

      // Subscribe to new messages in this session
      messageSubRef.current = subscribeToSessionMessages(newSession.id, (msg) => {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      });

      // Subscribe to session status changes (agent joining, session closing)
      statusSubRef.current = subscribeToSessionStatus(newSession.id, (updatedSession) => {
        setSession(updatedSession);
        if (updatedSession.status === 'active' && updatedSession.agent_id) {
          setAgentJoined(true);
          setIsWaiting(false);
          setIsConnected(true);
        }
        if (updatedSession.status === 'closed') {
          setIsConnected(false);
          setIsWaiting(false);
        }
      });

      // Load any existing messages (in case of reconnection)
      const existingMessages = await getSessionMessages(newSession.id);
      if (existingMessages.length > 0) {
        setMessages(existingMessages);
      }

      return newSession;
    } catch (err) {
      console.error('Failed to create agent session:', err);
      setIsWaiting(false);
      throw err;
    }
  }, []);

  /**
   * Send a message from the user side
   */
  const sendUserMessage = useCallback(async (text) => {
    if (!session) {
      console.error('No active session');
      return;
    }
    try {
      await sendMessage(session.id, 'user', userId.current, text);
    } catch (err) {
      console.error('Failed to send message:', err);
      throw err;
    }
  }, [session]);

  /**
   * Disconnect and clean up subscriptions
   */
  const disconnect = useCallback(() => {
    if (messageSubRef.current) {
      messageSubRef.current.unsubscribe();
      messageSubRef.current = null;
    }
    if (statusSubRef.current) {
      statusSubRef.current.unsubscribe();
      statusSubRef.current = null;
    }
    setIsConnected(false);
    setIsWaiting(false);
    setSession(null);
    setAgentJoined(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectToAgent,
    sendMessage: sendUserMessage,
    disconnect,
    isConnected,
    isWaiting,
    agentJoined,
    messages,
    session,
    userId: userId.current,
  };
};
