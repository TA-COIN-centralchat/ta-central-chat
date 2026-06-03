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
const SHARED_STORAGE_KEY = "tacoin_notifications_shared";
const BACKFILL_HOURS = 24;

const loadPersistedNotifications = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SHARED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_NOTIFICATIONS) : [];
  } catch (error) {
    console.warn("Failed to load persisted notifications:", error);
    return [];
  }
};

const persistNotifications = (notifications) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SHARED_STORAGE_KEY,
      JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)),
    );
  } catch (error) {
    console.warn("Failed to persist notifications:", error);
  }
};

const mergeNotifications = (current, additions) => {
  const seen = new Set(current.map((item) => item.id));
  const merged = [...current];
  additions.forEach((item) => {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  });
  merged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return merged.slice(0, MAX_NOTIFICATIONS);
};

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

// eslint-disable-next-line react-refresh/only-export-components
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
      path: sessionId ? `/live-chat/${sessionId}` : "/live-chat",
      from: "/live-chat",
      fromLabel: "Live Chat Sessions",
      mode: "session",
      channel: "Website Chatbot",
    };
  }

  return {
    path: sessionId ? `/live-chat/${sessionId}` : "/live-chat",
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

  const channel = String(
    session?.channel || metadata.channel || "",
  ).toLowerCase();
  const isTelegram = channel.includes("telegram");

  // For Telegram sessions the bot has been observed writing free-form text
  // (sometimes the customer's first message) into metadata.customerName.
  // Trust the actual Telegram identifiers first so the dashboard shows a
  // stable username/handle instead of whatever the customer typed.
  if (isTelegram) {
    if (metadata.telegramUsername) return `@${metadata.telegramUsername}`;
    const firstName = metadata.telegramFirstName || metadata.firstName;
    const lastName = metadata.telegramLastName || metadata.lastName;
    const fullTelegramName = [firstName, lastName].filter(Boolean).join(" ");
    if (fullTelegramName) return fullTelegramName;
    if (metadata.telegramChatId) return `@${metadata.telegramChatId}`;
  }

  return (
    metadata.customerName ||
    metadata.fullName ||
    metadata.telegramUsername ||
    session?.user_id ||
    "Customer"
  );
};

const backfillRecentActivity = async (existing, currentAgent) => {
  try {
    const since = new Date(
      Date.now() - BACKFILL_HOURS * 60 * 60 * 1000,
    ).toISOString();
    const existingIds = new Set(existing.map((item) => item.id));

    const [sessionsResult, ticketsResult] = await Promise.all([
      supabase
        .from("chat_sessions")
        .select("id, channel, metadata, created_at, status")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(MAX_NOTIFICATIONS),
      // Backfill scope mirrors the live realtime rule: admin sees every
      // ticket; non-admin agents see only tickets assigned to them OR
      // created by them. RLS enforces the same on the server.
      (() => {
        let q = supabase
          .from("tickets")
          .select("id, ticket_number, status, created_at, assigned_agent_id, created_by_agent_id")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(MAX_NOTIFICATIONS);
        const role = String(currentAgent?.role || "").toLowerCase();
        if (role !== "admin" && currentAgent?.id) {
          q = q.or(
            `assigned_agent_id.eq.${currentAgent.id},created_by_agent_id.eq.${currentAgent.id}`,
          );
        }
        return q;
      })(),
    ]);

    const synthesized = [];

    (sessionsResult.data || []).forEach((session) => {
      const id = `backfill-session-${session.id}`;
      if (existingIds.has(id)) return;
      const channelLabel = getChannelLabel(session);
      const route = getChannelRoute(channelLabel, session.id);
      synthesized.push({
        id,
        kind: "session",
        severity: "info",
        title: `${channelLabel} session`,
        body: `${channelLabel} customer session opened.`,
        link: route.path,
        linkState: {
          from: route.from,
          fromLabel: route.fromLabel,
          mode: route.mode,
          channel: route.channel,
        },
        createdAt: session.created_at,
        read: true,
      });
    });

    (ticketsResult.data || []).forEach((ticket) => {
      const id = `backfill-ticket-${ticket.id}`;
      if (existingIds.has(id)) return;
      synthesized.push({
        id,
        kind: "ticket",
        severity: "info",
        title: "Ticket created",
        body: `Ticket ${ticket.ticket_number || ""} was created.`,
        link: "/tickets",
        createdAt: ticket.created_at,
        read: true,
      });
    });

    return synthesized;
  } catch (error) {
    console.warn("Failed to backfill recent activity:", error);
    return [];
  }
};

export const NotificationProvider = ({ children }) => {
  const { currentAgent } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState("connecting");
  const toastTimerRef = useRef(null);
  const notificationsRef = useRef([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

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

  useEffect(() => {
    if (!currentAgent?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotifications([]);
      return;
    }

    const persisted = loadPersistedNotifications();
    setNotifications(persisted);

    backfillRecentActivity(persisted, currentAgent).then((extras) => {
      if (extras.length === 0) return;
      setNotifications((prev) => mergeNotifications(prev, extras));
    });
    // `currentAgent` identity churns on every re-render, but the only thing we
    // care about for re-running the backfill is the agent identity (id+role).
    // The role can't change without a re-login, which also changes the id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAgent?.id]);

  useEffect(() => {
    persistNotifications(notifications);
  }, [notifications]);

  const pushNotification = useCallback((entry) => {
    const item = {
      id: entry.id || crypto.randomUUID(),
      createdAt: entry.createdAt || new Date().toISOString(),
      read: false,
      severity: "info",
      kind: "system",
      ...entry,
    };

    const isNew = !notificationsRef.current.some((e) => e.id === item.id);

    // Snackbar pops for any new unread notification — not just chat messages.
    // Backfilled history (read: true) is silent so the user isn't blasted on login.
    if (isNew && !item.read) {
      setToastNotification(item);
    }

    setNotifications((prev) => {
      const existingIndex = prev.findIndex((entry) => entry.id === item.id);
      if (existingIndex !== -1) return prev;
      return [item, ...prev].slice(0, MAX_NOTIFICATIONS);
    });

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

    // Returns true when a session event is relevant to the current viewer.
    // - Admin sees every session event.
    // - Non-admin sees only events for sessions assigned to them (post- or
    //   pre-migration column).
    // - Unassigned/waiting sessions are scoped to admin only — clicking a
    //   notification for an unassigned session would route to a session that
    //   ends up being someone else's anyway.
    const isMySession = (sessionData, oldSessionData) => {
      if (isAdmin) return true;
      const newAssignee =
        sessionData?.assigned_agent_id || sessionData?.agent_id || null;
      const oldAssignee =
        oldSessionData?.assigned_agent_id || oldSessionData?.agent_id || null;
      return (
        newAssignee === currentAgent.id || oldAssignee === currentAgent.id
      );
    };

    const sessionChannel = supabase
      .channel(`notifications-chat-sessions-${currentAgent.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_sessions" },
        (payload) => {
          const sessionData = payload.new;

          // Only notify the agent the session was actually assigned to at
          // creation time. Admins get all. New unassigned (waiting) sessions
          // notify admins only — non-admin agents will be pinged via the
          // UPDATE handler below if/when autoAssign drops it onto them.
          if (!isMySession(sessionData, null)) return;

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
          const oldSessionData = payload.old;
          const prevStatus = oldSessionData?.status;
          const nextStatus = sessionData?.status;
          const channelLabel = getChannelLabel(sessionData);
          const route = getChannelRoute(channelLabel, sessionData?.id);

          // Same scoping rule as INSERT — admin sees all, non-admin sees only
          // sessions that touch them (assigned to them before or after).
          if (!isMySession(sessionData, oldSessionData)) return;

          if (
            prevStatus !== "active" &&
            nextStatus === "active" &&
            sessionData?.assigned_agent_id
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

    // Mirrors isMySession for tickets: admin sees every ticket event; a
    // non-admin agent sees only tickets they're assigned to or that they
    // created (now or, for an UPDATE, before the change — so reassignment
    // events still reach the agent losing the ticket).
    const isMyTicket = (ticketData, oldTicketData) => {
      if (isAdmin) return true;
      const newAssignee = ticketData?.assigned_agent_id || null;
      const oldAssignee = oldTicketData?.assigned_agent_id || null;
      const newCreator = ticketData?.created_by_agent_id || null;
      const oldCreator = oldTicketData?.created_by_agent_id || null;
      return (
        newAssignee === currentAgent.id ||
        oldAssignee === currentAgent.id ||
        newCreator === currentAgent.id ||
        oldCreator === currentAgent.id
      );
    };

    const ticketChannel = supabase
      .channel(`notifications-tickets-${currentAgent.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets" },
        (payload) => {
          const ticket = payload.new;
          if (!isMyTicket(ticket, null)) return;
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
          if (!isMyTicket(payload.new, payload.old)) return;
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
              newMessage.sender_role ||
                newMessage.sender_type ||
                newMessage.sender ||
                newMessage.role ||
                "",
            ).toLowerCase();

            // Only customer-originated messages produce a notification.
            // Agent/admin replies, system events, and bot auto-replies are
            // filtered out so the agent isn't pinged about their own sends.
            if (
              senderType === "agent" ||
              senderType === "admin" ||
              senderType === "system" ||
              senderType === "bot"
            ) {
              return;
            }

            const { data: session, error: sessionError } = await supabase
              .from("chat_sessions")
              .select("id, assigned_agent_id, agent_id, channel, metadata, user_id")
              .eq("id", sessionId)
              .maybeSingle();

            if (sessionError || !session) return;

            // Accept either column. The dashboard writes assigned_agent_id;
            // legacy/external producers (e.g. the Telegram bot) may still be
            // writing the older agent_id text column.
            const sessionAgent =
              session.assigned_agent_id || session.agent_id || null;
            if (sessionAgent !== currentAgent.id) return;

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
        .subscribe(handleSubscribeStatus);
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

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationProvider",
    );
  }
  return context;
};
