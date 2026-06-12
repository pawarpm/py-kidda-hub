import { useEffect, useState } from 'react';
import { Bell, Check, Loader2, Trash2 } from 'lucide-react';
import { api } from '../lib/api';

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: 'Low' | 'Medium' | 'High';
  status: string;
  publish_at?: string;
  publishAt?: string;
  created_at?: string;
  createdByName: string;
  isRead: boolean;
  readAt?: string | null;
};

export function priorityClass(priority: string) {
  if (priority === 'High') return 'border-red-200 bg-red-50 text-red-700';
  if (priority === 'Medium') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

export default function Notifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const result = await api<{ notifications: NotificationItem[]; unreadCount: number }>('/notifications');
      setItems(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    await api(`/notifications/${id}/read`, { method: 'POST' });
    load();
  }

  async function clearOne(id: string) {
    await api(`/notifications/${id}/clear`, { method: 'POST' });
    load();
  }

  if (loading) return <div className="panel flex min-h-72 items-center justify-center gap-2 p-6 text-slate-500"><Loader2 className="animate-spin" size={18} /> Loading notifications</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-normal">Notifications</h1>
          <p className="text-sm text-slate-500">{unreadCount} unread notification{unreadCount === 1 ? '' : 's'}</p>
        </div>
      </div>
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="space-y-3">
        {items.length === 0 && <div className="panel p-6 text-sm text-slate-500">No notifications right now.</div>}
        {items.map((item) => (
          <article key={item.id} className={`panel border-l-4 p-5 ${item.isRead ? 'border-l-slate-200' : 'border-l-brand bg-blue-50/30'}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Bell size={16} className={item.isRead ? 'text-slate-400' : 'text-brand'} />
                  <h2 className="font-bold">{item.title}</h2>
                  {!item.isRead && <span className="rounded bg-brand px-2 py-0.5 text-xs font-bold text-white">Unread</span>}
                  <span className={`rounded border px-2 py-0.5 text-xs font-bold ${priorityClass(item.priority)}`}>{item.priority}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{item.message}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>{item.type}</span>
                  <span>Created by {item.createdByName}</span>
                  <span>{new Date(item.publish_at || item.publishAt || item.created_at || Date.now()).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {!item.isRead && <button className="btn btn-soft" onClick={() => markRead(item.id)}><Check size={15} /> Read</button>}
                <button className="btn btn-soft" onClick={() => clearOne(item.id)}><Trash2 size={15} /> Clear</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
