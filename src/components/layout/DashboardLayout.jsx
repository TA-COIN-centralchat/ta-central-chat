import { Bell, Menu, Plus, Search, Wifi, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { supabase } from '../../services/supabaseClient';

const MAX_ACTIVE_SESSIONS_PER_AGENT = 5;
const HEARTBEAT_INTERVAL_MS = 30000;

const DashboardLayout = ({ title, description, children }) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [toastNotification, setToastNotification] = useState(null);

  useEffect(() => {
    let stopped = false;
    let intervalId;

    const getStoredAgentInfo = () => {
      return {
        agentId:
          localStorage.getItem('currentAgentId') ||
          localStorage.getItem('tacoin_agent_id') ||
          localStorage.getItem('agentId') ||
          null,
        fullName:
          localStorage.getItem('currentUserName') ||
          localStorage.getItem('tacoin_agent_name') ||
          localStorage.getItem('agentName') ||
          'Agent',
        email:
          localStorage.getItem('currentUserEmail') ||
          localStorage.getItem('tacoin_agent_email') ||
          localStorage.getItem('agentEmail') ||
          null,
        role:
          localStorage.getItem('currentUserRole') ||
          localStorage.getItem('tacoin_agent_role') ||
          localStorage.getItem('agentRole') ||
          'Customer Service Agent',
      };
    };

    const findAgentProfile = async () => {
      const storedAgent = getStoredAgentInfo();

      if (storedAgent.agentId) {
        const { data, error } = await supabase
          .from('agents')
          .select('id, full_name, email, role, status')
          .eq('id', storedAgent.agentId)
          .maybeSingle();

        if (!error && data) {
          return data;
        }
      }

      if (storedAgent.email) {
        const { data, error } = await supabase
          .from('agents')
          .select('id, full_name, email, role, status')
          .eq('email', storedAgent.email)
          .maybeSingle();

        if (!error && data) {
          localStorage.setItem('currentAgentId', data.id);
          localStorage.setItem('currentUserName', data.full_name || 'Agent');
          localStorage.setItem('currentUserEmail', data.email || '');
          localStorage.setItem('currentUserRole', data.role || storedAgent.role);

          return data;
        }
      }

      if (storedAgent.fullName && storedAgent.fullName !== 'Agent') {
        const { data, error } = await supabase
          .from('agents')
          .select('id, full_name, email, role, status')
          .eq('full_name', storedAgent.fullName)
          .maybeSingle();

        if (!error && data) {
          localStorage.setItem('currentAgentId', data.id);
          localStorage.setItem('currentUserName', data.full_name || 'Agent');
          localStorage.setItem('currentUserEmail', data.email || '');
          localStorage.setItem('currentUserRole', data.role || storedAgent.role);

          return data;
        }
      }

      return null;
    };

    const getActiveSessionCount = async (agentId) => {
      const { count, error } = await supabase
        .from('chat_sessions')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq('agent_id', agentId)
        .eq('status', 'active');

      if (error) {
        console.warn('Failed to count active sessions:', error);
        return 0;
      }

      return count || 0;
    };

    const updateAgentPresence = async () => {
      try {
        const agent = await findAgentProfile();

        if (!agent?.id || stopped) {
          return;
        }

        const activeSessionCount = await getActiveSessionCount(agent.id);

        const agentStatus =
          activeSessionCount >= MAX_ACTIVE_SESSIONS_PER_AGENT
            ? 'Busy'
            : 'Available';

        const now = new Date().toISOString();

        await supabase.from('agent_presence').upsert(
          {
            agent_id: agent.id,
            full_name: agent.full_name || 'Agent',
            email: agent.email || null,
            role: agent.role || 'Customer Service Agent',
            presence_status: 'Online',
            agent_status: agentStatus,
            active_session_count: activeSessionCount,
            last_seen_at: now,
            logged_in_at: now,
            logged_out_at: null,
            updated_at: now,
          },
          {
            onConflict: 'agent_id',
          }
        );

        await supabase
          .from('agents')
          .update({
            status: agentStatus,
          })
          .eq('id', agent.id);
      } catch (error) {
        console.warn('Agent heartbeat failed:', error);
      }
    };

    updateAgentPresence();

    intervalId = window.setInterval(() => {
      updateAgentPresence();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      stopped = true;

      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  useEffect(() => {
    const currentAgentId =
      localStorage.getItem('currentAgentId') ||
      localStorage.getItem('tacoin_agent_id') ||
      localStorage.getItem('agentId') ||
      null;

    const currentUserRole =
      localStorage.getItem('currentUserRole') ||
      localStorage.getItem('tacoin_agent_role') ||
      localStorage.getItem('agentRole') ||
      null;

    if (!currentAgentId || currentUserRole === 'Admin') {
      return undefined;
    }

    const handleNewChatMessage = async (newMessage) => {
      try {
        const sessionId = newMessage.session_id;

        if (!sessionId) {
          return;
        }

        const senderType = String(
          newMessage.sender_type ||
            newMessage.sender ||
            newMessage.role ||
            ''
        ).toLowerCase();

        if (
          senderType === 'agent' ||
          senderType === 'admin' ||
          senderType === 'system'
        ) {
          return;
        }

        const { data: session, error: sessionError } = await supabase
          .from('chat_sessions')
          .select('id, agent_id, channel, metadata, user_id')
          .eq('id', sessionId)
          .maybeSingle();

        if (sessionError) {
          console.warn('Failed to check notification session:', sessionError);
          return;
        }

        if (!session) {
          return;
        }

        if (session.agent_id !== currentAgentId) {
          return;
        }

        const metadata = session.metadata || {};

        const customerName =
          metadata.customerName ||
          metadata.fullName ||
          metadata.telegramUsername ||
          session.user_id ||
          'Customer';

        const messageText =
          newMessage.content ||
          newMessage.message_text ||
          newMessage.text ||
          'New customer message';

        const notification = {
          id: newMessage.id || `${sessionId}-${Date.now()}`,
          sessionId,
          customerName,
          channel: session.channel || 'Telegram',
          message: messageText,
          createdAt: newMessage.created_at || new Date().toISOString(),
        };

        setNotifications((prev) => [notification, ...prev].slice(0, 10));
        setNotificationCount((prev) => prev + 1);
        setToastNotification(notification);

        window.setTimeout(() => {
          setToastNotification(null);
        }, 4500);

        console.log('✅ Agent notification received:', notification);
      } catch (error) {
        console.warn('Failed to handle message notification:', error);
      }
    };

    const notificationSub = supabase
      .channel(`agent-message-notifications-${currentAgentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          handleNewChatMessage(payload.new);
        }
      )
      .subscribe((status) => {
        console.log('📡 Agent notification realtime status:', status);
      });

    return () => {
      notificationSub.unsubscribe();
    };
  }, []);

  const handleBellClick = () => {
    setNotificationOpen((prev) => !prev);

    if (!notificationOpen) {
      setNotificationCount(0);
    }
  };

  const openNotificationSession = (notification) => {
    setNotificationOpen(false);
    setNotificationCount(0);

    navigate(`/telegram/${notification.sessionId}`, {
      state: {
        from: '/telegram',
        fromLabel: 'Telegram Sessions',
        mode: 'telegram-chat',
        channel: notification.channel || 'Telegram',
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-[#edf1f5] bg-white/85 backdrop-blur-xl">
          <div className="flex min-h-20 items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#e8edf2] bg-white text-[#6e6e73] transition hover:-translate-y-0.5 hover:border-[#d8eef7] hover:bg-[#f7fbfd] hover:text-[#2389b8] lg:hidden"
                aria-label="Open sidebar"
              >
                <Menu size={20} />
              </button>

              <div className="min-w-0">
                <h1
                  title={title}
                  className="truncate text-xl font-semibold tracking-[-0.03em] text-[#1d1d1f] sm:text-2xl"
                >
                  {title}
                </h1>

                {description && (
                  <p
                    title={description}
                    className="mt-1 hidden max-w-3xl truncate text-sm leading-6 text-[#6e6e73] sm:block"
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="hidden h-11 items-center gap-2 rounded-2xl border border-[#e8edf2] bg-[#f8fafc] px-4 transition focus-within:border-[#43acd6] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#43acd6]/10 xl:flex">
                <Search size={16} className="shrink-0 text-[#8e8e93]" />

                <input
                  placeholder="Search ticket, customer..."
                  className="w-56 bg-transparent text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
                />
              </div>

              <div className="hidden h-11 items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 sm:inline-flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <Wifi size={15} />
                Connected
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={handleBellClick}
                  className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8edf2] bg-white text-[#6e6e73] transition hover:-translate-y-0.5 hover:border-[#d8eef7] hover:bg-[#f7fbfd] hover:text-[#2389b8]"
                  aria-label="Notifications"
                >
                  <Bell size={18} />

                  {notificationCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white ring-2 ring-white">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </button>

                {notificationOpen && (
                  <div className="absolute right-0 top-13 z-50 w-80 overflow-hidden rounded-3xl border border-[#e8edf2] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:w-96">
                    <div className="flex items-center justify-between border-b border-[#edf1f5] px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold text-[#1d1d1f]">
                          Notifications
                        </div>

                        <div className="text-xs text-[#8e8e93]">
                          New assigned customer messages
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setNotificationOpen(false)}
                        className="rounded-xl p-1.5 text-[#8e8e93] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-[#6e6e73]">
                        No new notifications yet.
                      </div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.map((notification) => (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() =>
                              openNotificationSession(notification)
                            }
                            className="block w-full border-b border-[#edf1f5] px-4 py-3 text-left transition last:border-b-0 hover:bg-[#f7fbfd]"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef9fd] text-sm font-semibold text-[#2389b8] ring-1 ring-[#43acd6]/15">
                                {notification.customerName
                                  ?.charAt(0)
                                  ?.toUpperCase() || 'C'}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-[#1d1d1f]">
                                  {notification.customerName}
                                </div>

                                <div className="mt-1 line-clamp-2 text-xs leading-5 text-[#6e6e73]">
                                  {notification.message}
                                </div>

                                <div className="mt-1 text-[11px] text-[#8e8e93]">
                                  {formatNotificationTime(
                                    notification.createdAt
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => navigate('/manual-ticket')}
                className="hidden h-11 items-center justify-center gap-2 rounded-2xl bg-[#43acd6] px-4 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:-translate-y-0.5 hover:bg-[#2389b8] hover:shadow-[0_18px_36px_rgba(67,172,214,0.24)] sm:inline-flex"
              >
                <Plus size={16} />
                New Ticket
              </button>
            </div>
          </div>

          {description && (
            <div className="border-t border-[#edf1f5] px-4 pb-4 text-sm leading-6 text-[#6e6e73] sm:hidden">
              {description}
            </div>
          )}
        </header>

        <section className="max-w-full overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="min-w-0">{children}</div>
        </section>
      </main>

      {toastNotification && (
        <button
          type="button"
          onClick={() => openNotificationSession(toastNotification)}
          className="fixed bottom-6 right-6 z-50 w-80 rounded-3xl border border-[#d8eef7] bg-white p-4 text-left shadow-[0_24px_70px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_80px_rgba(15,23,42,0.22)] sm:w-96"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef9fd] text-sm font-semibold text-[#2389b8] ring-1 ring-[#43acd6]/15">
              {toastNotification.customerName?.charAt(0)?.toUpperCase() ||
                'C'}
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#1d1d1f]">
                New customer message
              </div>

              <div className="mt-1 truncate text-sm font-medium text-[#2389b8]">
                {toastNotification.customerName}
              </div>

              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#6e6e73]">
                {toastNotification.message}
              </p>
            </div>
          </div>
        </button>
      )}
    </div>
  );
};

const formatNotificationTime = (value) => {
  if (!value) return 'Just now';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default DashboardLayout;