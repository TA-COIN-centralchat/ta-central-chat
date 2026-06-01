import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../services/supabaseClient";
import { autoAssignWaitingChatSessions } from "../services/realtimeChat";

const NotificationContext = createContext(null);
const MAX_NOTIFICATIONS = 50;

const getChannelLabel = (session) => {
  const metadata =
    session?.metadata && typeof session.metadata === "object"
      ? session.metadata
      : {};

  return metadata.channel || metadata.sourceChannel || "Live Chat";
};

const isResolvedStatus = (status = "") => {
  const normalized = String(status).toLowerCase().trim();
  return normalized === "resolved" || normalized === "closed";
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [currentAgent, setCurrentAgent] = useState(null);

  const pushNotification = useCallback((entry) => {
    const item = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      read: false,
      ...entry,
    };

    setNotifications((prev) => [item, ...prev].slice(0, MAX_NOTIFICATIONS));
  }, []);

  useEffect(() => {
    let isMounted = true;

    const resolveAgent = async (session) => {
      if (!session?.user?.email) {
        if (isMounted) setCurrentAgent(null);
        return;
      }

      const { data: agent, error } = await supabase
        .from("agents")
        .select("id, role, email")
        .eq("email", session.user.email)
        .single();

      if (error || !agent) {
        if (isMounted) setCurrentAgent(null);
        return;
      }

      if (isMounted) setCurrentAgent(agent);
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) return;
      resolveAgent(data?.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveAgent(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [pushNotification]);

  useEffect(() => {
    if (!currentAgent) {
      return undefined;
    }

    const chatChannel = supabase
      .channel(`notifications-chat-sessions-${currentAgent.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_sessions" },
        (payload) => {
          const sessionData = payload.new;
          pushNotification({
            severity: "info",
            title: "New live chat session",
            body: `${getChannelLabel(sessionData)} customer started a new session.`,
            link: "/live-chat",
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_sessions" },
        (payload) => {
          const nextStatus = payload.new?.status;
          const prevStatus = payload.old?.status;

          if (
            prevStatus !== "active" &&
            nextStatus === "active" &&
            payload.new?.agent_id
          ) {
            pushNotification({
              severity: "success",
              title: "Session assigned",
              body: "Session was assigned to an available agent.",
              link: "/live-chat",
            });
          }

          if (prevStatus !== "closed" && nextStatus === "closed") {
            pushNotification({
              severity: "warning",
              title: "Session ended",
              body: "A live chat session has ended.",
              link: "/live-chat",
            });
          }
        },
      )
      .subscribe();

    const ticketChannel = supabase
      .channel(`notifications-tickets-${currentAgent.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets" },
        (payload) => {
          const ticket = payload.new;
          pushNotification({
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

          if (!isResolvedStatus(oldStatus) && isResolvedStatus(newStatus)) {
            pushNotification({
              severity: "success",
              title: "Issue resolved",
              body: `Ticket ${payload.new?.ticket_number || ""} marked as ${newStatus}.`,
              link: "/closed",
            });
          }
        },
      )
      .subscribe();

    const autoAssignInterval = setInterval(() => {
      autoAssignWaitingChatSessions().catch((error) => {
        console.error("Live chat auto-assignment failed:", error);
      });
    }, 15000);

    return () => {
      clearInterval(autoAssignInterval);
      chatChannel.unsubscribe();
      ticketChannel.unsubscribe();
    };
  }, [currentAgent, pushNotification]);

  useEffect(() => {
    if (notifications.length === 0) return undefined;

    const timer = setTimeout(() => {
      setNotifications((prev) => {
        if (prev.length === 0) return prev;
        const [latest, ...rest] = prev;
        return [{ ...latest, read: true }, ...rest];
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [notifications]);

  const unreadCount = notifications.filter((item) => !item.read).length;

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      panelOpen,
      setPanelOpen,
      markAllRead,
      addNotification: pushNotification,
    }),
    [markAllRead, notifications, panelOpen, unreadCount, pushNotification],
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
