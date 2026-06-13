import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Filter, Shuffle } from 'lucide-react';
import { api } from '../lib/api';

type Question = { id: string; title: string; category: string; topic: string; difficulty: string; points: number };

export default function QuestionBank() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({ search: '', topic: '', difficulty: '', category: params.get('category') || '' });

  useEffect(() => {
    const qs = new URLSearchParams(filters).toString();
    api<Question[]>(`/questions?${qs}`).then(setQuestions).catch(() => {});
  }, [filters]);

  async function random() {
    const q = await api<Question>('/questions/random');
    window.location.href = `/questions/${q.id}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Question Bank</h1>
          <p className="text-sm text-slate-500">Syllabus-based Python questions from your engineering assignment PDF.</p>
        </div>
        <button className="btn btn-primary" onClick={random}><Shuffle size={16} /> Random</button>
      </div>
      <div className="panel grid gap-3 p-4 md:grid-cols-4">
        <input className="input" placeholder="Search problems" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <select className="input" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          <option value="">All categories</option>
          <option>Basic Python</option>
          <option>Intermediate Python</option>
          <option>Advanced Python</option>
        </select>
        <select className="input" value={filters.difficulty} onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}>
          <option value="">All difficulty</option>
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
        <input className="input" placeholder="Topic" value={filters.topic} onChange={(e) => setFilters({ ...filters, topic: e.target.value })} />
      </div>
      <div className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-sm font-bold"><Filter size={16} /> Problems</div>
        <div className="divide-y divide-slate-100">
          {questions.map((q) => (
            <Link key={q.id} to={`/questions/${q.id}`} className="grid gap-2 px-4 py-4 hover:bg-slate-50 md:grid-cols-[1fr_180px_100px_80px] md:items-center">
              <div>
                <div className="font-semibold">{q.title}</div>
                <div className="text-sm text-slate-500">{q.category} · {q.topic}</div>
              </div>
              <div className="text-sm text-slate-600">{q.topic}</div>
              <div className={`text-sm font-bold ${q.difficulty === 'Easy' ? 'text-emerald-600' : q.difficulty === 'Medium' ? 'text-orange-600' : 'text-red-600'}`}>{q.difficulty}</div>
              <div className="text-sm text-slate-500">{q.points} pts</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
