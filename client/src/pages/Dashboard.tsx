import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, LifeBuoy, Timer } from 'lucide-react';
import Metric from '../components/Metric';
import { api, getUser } from '../lib/api';

export default function Dashboard() {
  const [profile, setProfile] = useState<any>();
  const user = getUser();
  useEffect(() => {
    api('/profile').then(setProfile).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <div className="panel p-6">
          <div className="mb-3 text-sm font-bold text-brand">Student Dashboard</div>
          <h1 className="text-3xl font-bold tracking-normal">Good to see you, {user?.name.split(' ')[0]}.</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Practice Python by topic, run programs in the browser, submit against public and hidden test cases, and use analytics to prepare for practical exams and placements.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="btn btn-primary" to="/questions"><BookOpen size={16} /> Start Practice</Link>
            <Link className="btn btn-soft" to="/mock-tests"><Timer size={16} /> Take Mock Test</Link>
            <Link className="btn btn-soft" to="/reports"><LifeBuoy size={16} /> Report / Feedback</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Tests Attempted" value={profile?.stats?.attempts ?? 0} />
        <Metric label="Questions Solved" value={profile?.stats?.solved ?? 0} tone="green" />
        <Metric label="Accuracy" value={`${profile?.stats?.accuracy ?? 0}%`} tone="orange" />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {['Basic Python', 'Intermediate Python', 'Advanced Python'].map((category) => (
          <Link key={category} to={`/questions?category=${encodeURIComponent(category)}`} className="panel block p-5 hover:border-brand">
            <div className="text-lg font-bold">{category}</div>
            <p className="mt-2 text-sm text-slate-600">Syllabus-aligned problems with sample inputs, hidden tests, and instant score calculation.</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
