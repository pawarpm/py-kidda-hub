import { useEffect, useState } from 'react';
import { Check, Loader2, MessageCircle, Search, Send, UserRound, UserX, X } from 'lucide-react';
import { api, getUser } from '../lib/api';

type Student = { id: string; name: string; profilePictureUrl?: string | null; status?: string; relationship?: string; requestId?: string | null };
type RequestItem = { id: string; student: Student };
type Message = { id: string; sender_id: string; message_text: string; read_at?: string | null; created_at: string; sender?: Student };

function Avatar({ student, size = 'h-10 w-10' }: { student?: Student | null; size?: string }) {
  return (
    <div className={`grid ${size} shrink-0 place-items-center overflow-hidden rounded-full bg-blue-50 text-brand`}>
      {student?.profilePictureUrl ? <img className="h-full w-full object-cover" src={student.profilePictureUrl} alt={student.name} /> : <UserRound size={18} />}
    </div>
  );
}

export default function Friends() {
  const user = getUser();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Student[]>([]);
  const [friends, setFriends] = useState<Student[]>([]);
  const [incoming, setIncoming] = useState<RequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<RequestItem[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setError('');
    try {
      const [friendRows, requestRows, chatRows] = await Promise.all([
        api<Student[]>('/friends'),
        api<{ incoming: RequestItem[]; outgoing: RequestItem[] }>('/friend-requests'),
        api<any[]>('/chats')
      ]);
      setFriends(friendRows);
      setIncoming(requestRows.incoming);
      setOutgoing(requestRows.outgoing);
      setChats(chatRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load friends.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const text = query.trim();
    if (!text) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      api<Student[]>(`/friends/search?q=${encodeURIComponent(text)}`)
        .then((rows) => active && setResults(rows))
        .catch((err) => active && setError(err instanceof Error ? err.message : 'Search failed.'))
        .finally(() => active && setSearching(false));
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  async function openChat(friend: Student) {
    setSelected(friend);
    setError('');
    try {
      setMessages(await api<Message[]>(`/chats/${friend.id}/messages`));
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open chat.');
    }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !message.trim()) return;
    const text = message.trim();
    setMessage('');
    try {
      const created = await api<Message>(`/chats/${selected.id}/messages`, { method: 'POST', body: JSON.stringify({ message: text }) });
      setMessages((current) => [...current, created]);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.');
      setMessage(text);
    }
  }

  async function act(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      await refresh();
      if (query.trim()) setResults(await api<Student[]>(`/friends/search?q=${encodeURIComponent(query.trim())}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    }
  }

  if (loading) {
    return <div className="panel flex min-h-72 items-center justify-center gap-2 p-6 text-slate-500"><Loader2 className="animate-spin" size={18} /> Loading friends</div>;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="space-y-5">
        <div className="panel p-5">
          <h1 className="text-2xl font-bold tracking-normal">Add Friends</h1>
          <p className="mt-1 text-sm text-slate-600">Search classmates by name, send friend requests, and chat privately after becoming friends.</p>
          <div className="mt-4 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <Search size={17} className="text-slate-400" />
            <input className="w-full bg-transparent text-sm outline-none" placeholder="Search students by name" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          {error && <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="mt-4 space-y-2">
            {searching && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={15} /> Searching</div>}
            {query.trim() && !searching && results.length === 0 && <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">No students found</div>}
            {results.map((student) => (
              <div key={student.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar student={student} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{student.name}</div>
                    <div className="text-xs capitalize text-slate-500">{student.status || 'offline'}</div>
                  </div>
                </div>
                {student.relationship === 'friends' ? (
                  <button className="btn btn-soft" onClick={() => openChat(student)}><MessageCircle size={15} /> Chat</button>
                ) : student.relationship === 'request_sent' ? (
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">Requested</span>
                ) : student.relationship === 'request_received' ? (
                  <button className="btn btn-primary" onClick={() => act(() => api(`/friend-requests/${student.requestId}/respond`, { method: 'POST', body: JSON.stringify({ action: 'accept' }) }))}><Check size={15} /> Accept</button>
                ) : (
                  <button className="btn btn-primary" onClick={() => act(() => api('/friend-requests', { method: 'POST', body: JSON.stringify({ receiverId: student.id }) }))}>Add Friend</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="panel p-5">
            <h2 className="font-bold">Friend Requests</h2>
            <div className="mt-3 space-y-2">
              {incoming.length === 0 && <div className="text-sm text-slate-500">No incoming requests</div>}
              {incoming.map((request) => (
                <div key={request.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2"><Avatar student={request.student} size="h-8 w-8" /><b className="text-sm">{request.student.name}</b></div>
                  <div className="mt-3 flex gap-2">
                    <button className="btn btn-primary flex-1" onClick={() => act(() => api(`/friend-requests/${request.id}/respond`, { method: 'POST', body: JSON.stringify({ action: 'accept' }) }))}><Check size={14} /> Accept</button>
                    <button className="btn btn-soft flex-1" onClick={() => act(() => api(`/friend-requests/${request.id}/respond`, { method: 'POST', body: JSON.stringify({ action: 'reject' }) }))}><X size={14} /> Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel p-5">
            <h2 className="font-bold">Sent Requests</h2>
            <div className="mt-3 space-y-2">
              {outgoing.length === 0 && <div className="text-sm text-slate-500">No sent requests</div>}
              {outgoing.map((request) => <div key={request.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3"><Avatar student={request.student} size="h-8 w-8" /><b className="text-sm">{request.student.name}</b></div>)}
            </div>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="font-bold">My Friends</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {friends.length === 0 && <div className="text-sm text-slate-500">No friends yet</div>}
            {friends.map((friend) => (
              <div key={friend.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-2"><Avatar student={friend} /><div><b className="text-sm">{friend.name}</b><div className="text-xs capitalize text-slate-500">{friend.status}</div></div></div>
                <div className="mt-3 flex gap-2">
                  <button className="btn btn-primary flex-1" onClick={() => openChat(friend)}><MessageCircle size={15} /> Chat</button>
                  <button className="btn btn-soft" onClick={() => act(() => api(`/friends/${friend.id}`, { method: 'DELETE' }))}><UserX size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel flex min-h-[620px] flex-col overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <h2 className="font-bold">Private Chat</h2>
          <p className="text-sm text-slate-500">{selected ? `Chatting with ${selected.name}` : 'Select a friend to ask doubts privately.'}</p>
        </div>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[0.42fr_0.58fr]">
          <div className="border-b border-slate-200 p-3 lg:border-b-0 lg:border-r">
            <div className="text-xs font-bold uppercase tracking-normal text-slate-500">Recent chats</div>
            <div className="mt-3 space-y-2">
              {chats.length === 0 && <div className="text-sm text-slate-500">No chats yet</div>}
              {chats.map((chat) => (
                <button key={chat.id} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 p-2 text-left hover:bg-slate-50" onClick={() => openChat(chat.friend)}>
                  <Avatar student={chat.friend} size="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{chat.friend?.name}</div>
                    <div className="truncate text-xs text-slate-500">{chat.latestMessage?.message_text || 'No messages yet'}</div>
                  </div>
                  {chat.unread > 0 && <span className="rounded-full bg-coral px-2 py-0.5 text-xs font-bold text-white">{chat.unread}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="flex min-h-0 flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {!selected && <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Choose a friend to start chatting.</div>}
              {selected && messages.length === 0 && <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No messages yet. Ask your doubt first.</div>}
              {messages.map((item) => {
                const mine = item.sender_id === user?.id;
                return (
                  <div key={item.id} className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                    {!mine && <Avatar student={item.sender} size="h-8 w-8" />}
                    <div className={`max-w-[78%] rounded-lg px-3 py-2 ${mine ? 'bg-brand text-white' : 'bg-slate-100 text-slate-900'}`}>
                      <div className="text-sm">{item.message_text}</div>
                      <div className={`mt-1 text-[11px] ${mine ? 'text-blue-100' : 'text-slate-500'}`}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{mine ? item.read_at ? ' · Read' : ' · Sent' : ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-200 p-3">
              <input className="input" disabled={!selected} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={selected ? 'Type your doubt...' : 'Select a friend first'} />
              <button className="btn btn-primary" disabled={!selected || !message.trim()}><Send size={16} /></button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
