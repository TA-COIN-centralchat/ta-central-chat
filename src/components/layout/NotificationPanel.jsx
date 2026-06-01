import { CheckCircle, Info, X, XCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";
import { Link } from "react-router-dom";

const NotificationPanel = () => {
  const { notifications, panelOpen, setPanelOpen, markAllRead, unreadCount } = useNotifications();

  if (!panelOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-40" 
        onClick={() => setPanelOpen(false)} 
        aria-hidden="true" 
      />
      <div className="absolute right-4 top-20 z-50 mt-2 w-80 sm:w-96 origin-top-right overflow-hidden rounded-[24px] border border-[#e8edf2] bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl ring-1 ring-black/5 focus:outline-none sm:right-6 lg:right-8 dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] dark:ring-white/10">
        <div className="flex items-center justify-between border-b border-[#edf1f5] px-5 py-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-[#1d1d1f] dark:text-white">Notifications</h3>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-medium text-[#43acd6] transition hover:text-[#2389b8] dark:hover:text-[#43acd6]"
            >
              Mark all read
            </button>
          )}
        </div>
        
        <div className="max-h-[calc(100vh-200px)] min-h-[300px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center p-6 text-center text-sm text-[#8e8e93] dark:text-slate-500">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f8fafc] dark:bg-slate-800">
                <Info size={24} className="text-[#cbd5e1] dark:text-slate-600" />
              </div>
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[#edf1f5] dark:divide-slate-800">
              {notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`relative p-4 transition hover:bg-[#f8fafc] dark:hover:bg-slate-800/80 ${notification.read ? 'opacity-70' : 'bg-[#f7fbfd]/50 dark:bg-slate-800/40'}`}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5 shrink-0">
                      {notification.severity === 'success' && <CheckCircle size={18} className="text-emerald-500" />}
                      {notification.severity === 'warning' && <AlertTriangle size={18} className="text-amber-500" />}
                      {notification.severity === 'error' && <XCircle size={18} className="text-red-500" />}
                      {(!notification.severity || notification.severity === 'info') && <Info size={18} className="text-[#43acd6]" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium text-[#1d1d1f] dark:text-white ${!notification.read && 'font-semibold'}`}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#43acd6]" />
                        )}
                      </div>
                      
                      <p className="mt-1 text-xs leading-5 text-[#6e6e73] dark:text-slate-400">
                        {notification.body}
                      </p>
                      
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] font-medium text-[#8e8e93] dark:text-slate-500">
                          {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        
                        {notification.link && (
                          <Link 
                            to={notification.link}
                            onClick={() => setPanelOpen(false)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#43acd6] transition hover:text-[#2389b8] dark:hover:text-[#43acd6]"
                          >
                            View details
                            <ExternalLink size={10} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationPanel;