import { Bell, Menu, Plus, Search, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { supabase } from '../../services/supabaseClient';

const MAX_ACTIVE_SESSIONS_PER_AGENT = 5;
const HEARTBEAT_INTERVAL_MS = 30000;

const DashboardLayout = ({ title, description, children }) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
            updated_at: now,
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

              <button
                type="button"
                className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8edf2] bg-white text-[#6e6e73] transition hover:-translate-y-0.5 hover:border-[#d8eef7] hover:bg-[#f7fbfd] hover:text-[#2389b8]"
                aria-label="Notifications"
              >
                <Bell size={18} />

                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white ring-2 ring-white">
                  3
                </span>
              </button>

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
    </div>
  );
};

export default DashboardLayout;