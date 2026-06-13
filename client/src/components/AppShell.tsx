import { useEffect, useState } from 'react';
import { BarChart3, Bell, Code2, Info, LayoutDashboard, LifeBuoy, Loader2, LogOut, MessageSquareText, Moon, Settings, Shield, Sun, UserRound, Users, X, Trophy, Timer } from 'lucide-react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api, clearSession, getToken, getUser } from '../lib/api';
import { NotificationItem, priorityClass } from '../pages/Notifications';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/questions', label: 'Practice', icon: Code2 },
  { to: '/mock-tests', label: 'Mock Tests', icon: Timer },
  { to: '/friends', label: 'Friends', icon: Users },
  { to: '/groups', label: 'Groups', icon: MessageSquareText },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/reports', label: 'Report / Feedback', icon: LifeBuoy }
];

function statusClasses(status?: string) {
  if (status === 'online') return 'bg-emerald-500 text-emerald-700';
  if (status === 'idle') return 'bg-amber-400 text-amber-700';
  return 'bg-slate-400 text-slate-500';
}

function profilePromptKey(userId?: string) {
  return userId ? `pkh-profile-create-shown:${userId}` : '';
}

const THEME_STORAGE_KEY = 'pkh-theme';

function getInitialTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  if (document.documentElement.dataset.theme === 'dark' || document.documentElement.dataset.theme === 'light') {
    return document.documentElement.dataset.theme;
  }
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export default function AppShell() {
  const user = getUser();
  const [showCreditsInfo, setShowCreditsInfo] = useState(false);
  const [profileCheck, setProfileCheck] = useState<{ loading: boolean; exists: boolean; profile: any | null }>({ loading: true, exists: false, profile: null });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const syncTheme = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      if (event.newValue === 'dark' || event.newValue === 'light') setTheme(event.newValue);
    };
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, []);

  function toggleTheme() {
    setTheme((current) => current === 'dark' ? 'light' : 'dark');
  }

  useEffect(() => {
    if (!user || user.role === 'admin') {
      setProfileCheck({ loading: false, exists: true, profile: null });
      return;
    }
    let active = true;
    api<{ exists: boolean; profile: any | null }>('/student-profile')
      .then((result) => {
        if (!active) return;
        setProfileCheck({ loading: false, exists: result.exists, profile: result.profile });
        const promptKey = profilePromptKey(user.id);
        const alreadyShown = promptKey ? localStorage.getItem(promptKey) === 'true' : true;
        if (!result.exists && !alreadyShown && location.pathname !== '/profile/create') {
          localStorage.setItem(promptKey, 'true');
          navigate('/profile/create', { replace: true });
        }
      })
      .catch(() => {
        if (active) setProfileCheck({ loading: false, exists: true, profile: null });
      });
    return () => {
      active = false;
    };
  }, [location.pathname, navigate, user?.id, user?.role]);

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    let idleTimer = 0;

    const updateStatus = (status: 'online' | 'idle' | 'offline') => {
      api('/me/status', { method: 'POST', body: JSON.stringify({ status }) }).catch(() => {});
    };

    const markActive = () => {
      window.clearTimeout(idleTimer);
      updateStatus('online');
      idleTimer = window.setTimeout(() => updateStatus('idle'), 2 * 60 * 1000);
    };

    const markClosed = () => {
      const token = getToken();
      if (!token) return;
      fetch('/api/me/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'offline' }),
        keepalive: true
      }).catch(() => {});
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((eventName) => window.addEventListener(eventName, markActive, { passive: true }));
    window.addEventListener('beforeunload', markClosed);
    const heartbeat = window.setInterval(() => updateStatus(document.hidden ? 'idle' : 'online'), 60 * 1000);
    markActive();

    return () => {
      window.clearTimeout(idleTimer);
      window.clearInterval(heartbeat);
      events.forEach((eventName) => window.removeEventListener(eventName, markActive));
      window.removeEventListener('beforeunload', markClosed);
    };
  }, [user?.id, user?.role]);

  async function loadNotifications(showToast = false) {
    if (!user) return;
    try {
      const result = await api<{ notifications: NotificationItem[]; unreadCount: number }>('/notifications');
      if (showToast && result.unreadCount > unreadCount) {
        const firstUnread = result.notifications.find((item) => !item.isRead);
        if (firstUnread) {
          setToast(firstUnread);
          window.setTimeout(() => setToast(null), 3500);
        }
      }
      setNotifications(result.notifications.filter((item) => !item.isRead).slice(0, 5));
      setUnreadCount(result.unreadCount);
    } catch {
      // Keep navigation usable if notification loading fails.
    }
  }

  useEffect(() => {
    if (!user) return;
    loadNotifications(false);
    const interval = window.setInterval(() => loadNotifications(true), 45_000);
    return () => window.clearInterval(interval);
  }, [user?.id]);

  async function markNotificationRead(id: string) {
    await api(`/notifications/${id}/read`, { method: 'POST' });
    loadNotifications(false);
  }

  async function markAllNotificationsRead() {
    await api('/notifications/read-all', { method: 'POST' });
    setUnreadCount(0);
    setNotifications([]);
    setToast(null);
    loadNotifications(false);
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (user.role !== 'admin' && profileCheck.loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-600">
        <div className="panel flex items-center gap-2 p-5">
          <Loader2 className="animate-spin" size={18} />
          Checking student profile
        </div>
      </div>
    );
  }

  const displayName = profileCheck.profile?.fullName || user.name;
  const displayPicture = profileCheck.profile?.profilePictureUrl || user.avatar_url;
  const displayStatus = user.status || 'online';

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-4 lg:block">
        <div className="flex items-center gap-3 px-2 py-3">
          <img className="h-11 w-11 rounded-md object-cover shadow-sm" src="/py-kidda-hub-logo.png" alt="PY Kidda Hub logo" />
          <div>
            <div className="font-bold">PY Kidda Hub(PKH)</div>
            <div className="text-xs text-slate-500">Be a PY kidda with us</div>
          </div>
        </div>
        <nav className="mt-6 space-y-1">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-blue-50 text-brand' : 'text-slate-700 hover:bg-slate-100'}`}>
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
          {user.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-blue-50 text-brand' : 'text-slate-700 hover:bg-slate-100'}`}>
              <Shield size={18} />
              Admin
            </NavLink>
          )}
        </nav>
        <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-blue-100 bg-blue-50 p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <img className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-sm" src="/siddharth-pawar.jpeg" alt="Siddharth Prashant Pawar" />
            <div>
              <div className="text-xs font-bold uppercase tracking-normal text-brand">Credits</div>
              <div className="mt-1 text-sm font-bold leading-tight text-slate-900">Siddharth Prashant Pawar</div>
              <div className="text-xs text-slate-600">Developer & Manager</div>
            </div>
          </div>
          <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-2 py-1.5 text-xs font-bold text-brand shadow-sm hover:bg-blue-100" type="button" onClick={() => setShowCreditsInfo(true)}>
            <Info size={14} />
            Know More
          </button>
          {showCreditsInfo && (
            <div className="absolute bottom-full left-0 mb-3 w-72 rounded-lg border border-slate-200 bg-white p-4 text-slate-700 shadow-panel">
              <button className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" type="button" aria-label="Close developer information" onClick={() => setShowCreditsInfo(false)}>
                <X size={15} />
              </button>
              <div className="flex items-center gap-3 pr-6">
                <img className="h-14 w-14 rounded-full object-cover shadow-sm" src="/siddharth-pawar.jpeg" alt="Siddharth Prashant Pawar" />
                <div>
                  <div className="text-sm font-bold text-slate-900">About the developer</div>
                  <div className="text-xs text-slate-500">Siddharth Prashant Pawar</div>
                </div>
              </div>
              <p className="mt-2 text-sm leading-5">
                Hello everyone, my name is Siddharth Prashant Pawar, and I have created this website for practice purposes so that college students can test their Python skills and knowledge.
              </p>
              <div className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-brand">
                Developer and Manager Phone: 9172504205
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="lg:pl-64">
        <header className="sticky top-0 z-20 flex min-h-16 flex-col gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-50 text-brand">
              {displayPicture ? <img className="h-full w-full object-cover" src={displayPicture} alt={displayName} /> : <UserRound size={19} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-semibold">{displayName}</div>
                <span className={`h-2.5 w-2.5 rounded-full ${statusClasses(displayStatus).split(' ')[0]}`} title={displayStatus} />
              </div>
              <div className="text-xs text-slate-500">{user.college}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end lg:self-auto">
            <button
              className="btn btn-soft"
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
            <div className="relative">
              <button className="btn btn-soft relative" type="button" onClick={() => setShowNotifications(!showNotifications)} aria-label="Notifications">
                <Bell size={16} />
                {unreadCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-coral px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full z-30 mt-2 w-[min(360px,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-2 shadow-panel">
                  <div className="flex items-center justify-between px-2 py-2">
                    <div>
                      <div className="font-bold">New Notifications</div>
                      <div className="text-xs text-slate-500">{unreadCount} unread</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && <button className="text-xs font-bold text-brand" onClick={markAllNotificationsRead}>Mark all read</button>}
                      <button className="text-xs font-bold text-brand" onClick={() => { setShowNotifications(false); navigate('/notifications'); }}>Inbox</button>
                    </div>
                  </div>
                  <div className="max-h-96 space-y-2 overflow-y-auto">
                    {notifications.length === 0 && <div className="p-3 text-sm text-slate-500">No new notifications. Open Inbox to see older messages.</div>}
                    {notifications.map((item) => (
                      <button key={item.id} className="w-full rounded-lg border border-blue-200 bg-blue-50 p-3 text-left" onClick={() => markNotificationRead(item.id)}>
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-bold">{item.title}</div>
                          <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold ${priorityClass(item.priority)}`}>{item.priority}</span>
                        </div>
                        <div className="mt-1 max-h-9 overflow-hidden text-xs text-slate-600">{item.message}</div>
                        <div className="mt-1 text-[11px] text-slate-400">{item.type}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {user.role !== 'admin' && (
              <button className="btn btn-soft" type="button" onClick={() => navigate('/profile/edit')}>
                <Settings size={16} />
                <span className="hidden sm:inline">Edit Profile</span>
              </button>
            )}
            <button className="btn btn-soft" type="button" onClick={() => navigate('/reports')}>
              <LifeBuoy size={16} />
              <span className="hidden sm:inline">Report</span>
            </button>
            <button
              className="btn btn-soft"
              onClick={async () => {
                await api('/auth/logout', { method: 'POST' }).catch(() => {});
                clearSession();
                navigate('/auth');
              }}
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
      {toast && (
        <div className="fixed bottom-5 right-5 z-40 w-[min(360px,calc(100vw-2rem))] rounded-lg border border-blue-200 bg-white p-4 shadow-panel">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-brand"><Bell size={17} /></div>
            <div>
              <div className="text-sm font-bold">{toast.title}</div>
              <div className="mt-1 text-sm text-slate-600">{toast.message}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
