import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../services/supabaseClient";
import { autoAssignWaitingChatSessions } from "../services/realtimeChat";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

const MAX_NOTIFICATIONS = 50;
const TOAST_DURATION_MS = 4500;
const AUTO_ASSIGN_INTERVAL_MS = 15000;

const isResolvedStatus = (status = "") => {
  const normalized = String(status).toLowerCase().trim();
  return normalized === "resolved" || normalized === "closed";
};

const getChannelLabel = (session) => {
  const metadata =
    session?.metadata && typeof session.metadata === "object"
      ? session.metadata
      : {};

  return (
    session?.channel ||
    metadata.channel ||
    metadata.sourceChannel ||
    "Live Chat"
  );
};

const channelKey = (channel) =>
  String(channel || "").toLowerCase().trim();

export const getChannelRoute = (channel, sessionId) => {
  const key = channelKey(channel);

  if (key === "telegram") {
    return {
      path: sessionId ? `/telegram/${sessionId}` : "/telegram",
      from: "/telegram",
      fromLabel: "Telegram Sessions",
      mode: "telegram-chat",
      channel: "Telegram",
    };
  }

  if (key === "website chatbot" || key === "chatbot") {
    return {
      path: sessionId ? `/chatbot/${sessionId}` : "/chatbot",
      from: "/chatbot",
      fromLabel: "Chatbot Sessions",
      mode: "session",
      channel: "Website Chatbot",
    };
  }

  return {
    path: "/live-chat",
    from: "/live-chat",
    fromLabel: "Live Chat",
    mode: "session",
    channel: channel || "Live Chat",
  };
};

const getCustomerName = (session) => {
  const metadata =
    session?.metadata && typeof session.metadata === "object"
      ? session.metadata
      : {};

  return (
    metadata.customerName ||
    metadata.fullName ||
    metadata.telegramUsername ||
    session?.user_id ||
    "Customer"
  );
};

export const NotificationProvider = ({ children }) => {
  const { currentAgent } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState("connecting");
  const toastTimerRef = useRef(null);

  const handleSubscribeStatus = useCallback((status) => {
    if (status === "SUBSCRIBED") {
      setRealtimeStatus("connected");
    } else if (
      status === "CHANNEL_ERROR" ||
      status === "TIMED_OUT" ||
      status === "CLOSED"
    ) {
      setRealtimeStatus("disconnected");
    } else {
      setRealtimeStatus("connecting");
    }
  }, []);

  const pushNotification = useCallback((entry) => {
    const item = {
      id: entry.id || crypto.randomUUID(),
      createdAt: entry.createdAt || new Date().toISOString(),
      read: false,
      severity: "info",
      kind: "system",
      ...entry,
    };

    setNotifications((prev) => [item, ...prev].slice(0, MAX_NOTIFICATIONS));

    if (item.kind === "message") {
      setToastNotification(item);
    }

    return item;
  }, []);

  useEffect(() => {
    if (!toastNotification) {
      return undefined;
    }

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastNotification(null);
      toastTimerRef.current = null;
    }, TOAST_DURATION_MS);

    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [toastNotification]);

  useEffect(() => {
    if (!currentAgent?.id) {
      return undefined;
    }

    const isAdmin = String(currentAgent.role || "").toLowerCase() === "admin";

    const sessionChannel = supabase
      .channel(`notifications-chat-sessions-${currentAgent.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_sessions" },
        (payload) => {
          const sessionData = payload.new;
          const channelLabel = getChannelLabel(sessionData);
          const route = getChannelRoute(channelLabel, sessionData?.id);

          pushNotification({
            kind: "session",
            severity: "info",
            title: `New ${channelLabel} session`,
            body: `${channelLabel} customer started a new session.`,
            link: route.path,
            linkState: {
              from: route.from,
              fromLabel: route.fromLabel,
              mode: route.mode,
              channel: route.channel,
            },
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_sessions" },
        (payload) => {
          const sessionData = payload.new;
          const prevStatus = payload.old?.status;
          const nextStatus = sessionData?.status;
          const channelLabel = getChannelLabel(sessionData);
          const route = getChannelRoute(channelLabel, sessionData?.id);

          if (
            prevStatus !== "active" &&
            nextStatus === "active" &&
            sessionData?.agent_id
          ) {
            pushNotification({
              kind: "session",
              severity: "success",
              title: `${channelLabel} session assigned`,
              body: `A ${channelLabel} session was assigned to an agent.`,
              link: route.path,
              linkState: {
                from: route.from,
                fromLabel: route.fromLabel,
                mode: route.mode,
                channel: route.channel,
              },
            });
          }

          if (prevStatus !== "closed" && nextStatus === "closed") {
            pushNotification({
              kind: "session",
              severity: "warning",
              title: `${channelLabel} session ended`,
              body: `A ${channelLabel} session has ended.`,
              link: route.path,
              linkState: {
                from: route.from,
                fromLabel: route.fromLabel,
                mode: route.mode,
                channel: route.channel,
              },
            });
          }
        },
      )
      .subscribe(handleSubscribeStatus);

    const ticketChannel = supabase
      .channel(`notifications-tickets-${currentAgent.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets" },
        (payload) => {
          const ticket = payload.new;
          pushNotification({
            kind: "ticket",
            severity: "info",
            title: "Ticket created",
            body: `Ticket ${ticket.ticket_number || ""} was created.`,
            link: "/tickets",
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tickets" },
        (payload) => {
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          const oldAssignedTo = payload.old?.assigned_to;
          const newAssignedTo = payload.new?.assigned_to;
          const oldPriority = payload.old?.priority;
          const newPriority = payload.new?.priority;
          const ticketNumber = payload.new?.ticket_number || "";

          if (!isResolvedStatus(oldStatus) && isResolvedStatus(newStatus)) {
            pushNotification({
              kind: "ticket",
              severity: "success",
              title: "Issue resolved",
              body: `Ticket ${ticketNumber} marked as ${newStatus}.`,
              link: "/closed",
            });
          } else if (oldAssignedTo !== newAssignedTo && newAssignedTo) {
            pushNotification({
              kind: "ticket",
              severity: "info",
              title: "Ticket assigned",
              body: `Ticket ${ticketNumber} was assigned to an agent.`,
              link: "/tickets",
            });
          } else if (
            oldPriority !== newPriority &&
            (newPriority === "High" || newPriority === "Urgent")
          ) {
            pushNotification({
              kind: "ticket",
              severity: "warning",
              title: "Ticket escalated",
              body: `Ticket ${ticketNumber} priority escalated to ${newPriority}.`,
              link: "/tickets",
            });
          }
        },
      )
      .subscribe(handleSubscribeStatus);

    let messageChannel = null;

    if (!isAdmin) {
      messageChannel = supabase
        .channel(`notifications-chat-messages-${currentAgent.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          async (payload) => {
            const newMessage = payload.new;
            const sessionId = newMessage?.session_id;
            if (!sessionId) return;

            const senderType = String(
              newMessage.sender_type ||
                newMessage.sender ||
                newMessage.role ||
                "",
            ).toLowerCase();

            if (
              senderType === "agent" ||
              senderType === "admin" ||
              senderType === "system"
            ) {
              return;
            }

            const { data: session, error: sessionError } = await supabase
              .from("chat_sessions")
              .select("id, agent_id, channel, metadata, user_id")
              .eq("id", sessionId)
              .maybeSingle();

            if (sessionError || !session) return;
            if (session.agent_id !== currentAgent.id) return;

            const channelLabel = getChannelLabel(session);
            const route = getChannelRoute(channelLabel, sessionId);
            const customerName = getCustomerName(session);

            const messageText =
              newMessage.content ||
              newMessage.message_text ||
              newMessage.text ||
              "New customer message";

            pushNotification({
              id: newMessage.id || `${sessionId}-${Date.now()}`,
              createdAt: newMessage.created_at || new Date().toISOString(),
              kind: "message",
              severity: "info",
              title: customerName,
              body: messageText,
              link: route.path,
              linkState: {
                from: route.from,
                fromLabel: route.fromLabel,
                mode: route.mode,
                channel: route.channel,
              },
              sessionId,
              customerName,
              channel: route.channel,
            });
          },
        )
        .subscribe();
    }

    const autoAssignInterval = setInterval(() => {
      autoAssignWaitingChatSessions().catch((error) => {
        console.error("Live chat auto-assignment failed:", error);
      });
    }, AUTO_ASSIGN_INTERVAL_MS);

    return () => {
      clearInterval(autoAssignInterval);
      sessionChannel.unsubscribe();
      ticketChannel.unsubscribe();
      if (messageChannel) messageChannel.unsubscribe();
    };
  }, [currentAgent, pushNotification, handleSubscribeStatus]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  const markAllRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((item) => (item.read ? item : { ...item, read: true })),
    );
  }, []);

  const markRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id && !item.read ? { ...item, read: true } : item,
      ),
    );
  }, []);

  const dismissToast = useCallback(() => {
    setToastNotification(null);
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      panelOpen,
      setPanelOpen,
      markAllRead,
      markRead,
      addNotification: pushNotification,
      toastNotification,
      dismissToast,
      realtimeStatus,
    }),
    [
      notifications,
      unreadCount,
      panelOpen,
      markAllRead,
      markRead,
      pushNotification,
      toastNotification,
      dismissToast,
      realtimeStatus,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationProvider",
    );
  }
  return context;
};
