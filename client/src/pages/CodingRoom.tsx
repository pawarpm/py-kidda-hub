import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { ArrowLeft, PartyPopper, Play, RotateCcw, Send, Sparkles, SunMoon } from 'lucide-react';
import { api } from '../lib/api';

type SubmitMood = 'success' | 'retry' | null;

export default function CodingRoom() {
  const { id } = useParams();
  const [question, setQuestion] = useState<any>();
  const [code, setCode] = useState('');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [dark, setDark] = useState(true);
  const [hasActiveMock, setHasActiveMock] = useState(false);
  const [submitMood, setSubmitMood] = useState<SubmitMood>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const extensions = useMemo(() => [python()], []);
  const draftKey = id ? `questionDraft:${id}` : '';

  useEffect(() => {
    setHasActiveMock(Boolean(localStorage.getItem('activeMockAttempt')));
    api<any>(`/questions/${id}`).then((q) => {
      setQuestion(q);
      setCode(localStorage.getItem(`questionDraft:${id}`) || q.starter_code);
      setInput(q.sample_input);
      setOutput('');
      setResults([]);
      setError('');
    }).catch((err) => setError(err instanceof Error ? err.message : 'Could not load question'));
  }, [id]);

  useEffect(() => {
    if (!draftKey || !code || !question) return;
    localStorage.setItem(draftKey, code);
  }, [code, draftKey, question]);

  async function run() {
    if (isRunning || isSubmitting) return;
    setError('');
    setIsRunning(true);
    setOutput('Running...');
    try {
      const result = await api<any>('/run', { method: 'POST', body: JSON.stringify({ sourceCode: code, input }) });
      setOutput(result.stderr || result.stdout || '(no output)');
    } catch (err) {
      setOutput('');
      setError(err instanceof Error ? err.message : 'Could not run code');
    } finally {
      setIsRunning(false);
    }
  }

  async function submit() {
    if (isSubmitting || isRunning) return;
    setError('');
    setResults([]);
    setIsSubmitting(true);
    try {
      const result = await api<any>('/submit', { method: 'POST', body: JSON.stringify({ questionId: id, sourceCode: code }) });
      setOutput(`${result.status.toUpperCase()} · Score ${result.score}%`);
      setResults(result.results);
      setSubmitMood(result.score === 100 ? 'success' : 'retry');
      window.setTimeout(() => setSubmitMood(null), 1500);
    } catch (err) {
      setOutput('');
      setError(err instanceof Error ? err.message : 'Could not submit answer');
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetCode() {
    setCode(question.starter_code);
    if (draftKey) localStorage.removeItem(draftKey);
    setResults([]);
    setOutput('');
    setError('');
  }

  if (!question) return <div className="panel p-6">{error || 'Loading coding room...'}</div>;

  return (
    <div className="relative grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      {submitMood && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-slate-950/20 px-4 backdrop-blur-sm">
          <div className={`feedback-pop relative w-full max-w-md overflow-hidden rounded-lg border bg-white p-6 text-center shadow-panel ${submitMood === 'success' ? 'border-emerald-200' : 'border-orange-200'}`}>
            {submitMood === 'success' ? (
              <>
                <div className="confetti-field" aria-hidden="true">
                  {Array.from({ length: 18 }).map((_, index) => <span key={index} />)}
                </div>
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                  <PartyPopper size={34} />
                </div>
                <div className="mt-4 text-2xl font-bold text-slate-900">Perfect answer!</div>
                <p className="mt-2 text-sm text-slate-600">All test cases passed. Beautiful work.</p>
              </>
            ) : (
              <>
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-orange-50 text-orange-600">
                  <Sparkles size={34} />
                </div>
                <div className="mt-4 text-2xl font-bold text-slate-900">That’s totally fine</div>
                <p className="mt-2 text-sm text-slate-600">Try again. You are very close, and debugging is part of the game.</p>
                <div className="mt-4 rounded-md bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700">Check the failed cases and adjust your logic.</div>
              </>
            )}
          </div>
        </div>
      )}
      <section className="panel overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          {hasActiveMock && (
            <Link className="btn btn-soft mb-4" to="/mock-tests">
              <ArrowLeft size={16} />
              Back to Active Test
            </Link>
          )}
          <div className="text-sm font-bold text-brand">{question.category} · {question.topic}</div>
          <h1 className="mt-1 text-2xl font-bold">{question.title}</h1>
          <div className="mt-2 text-sm font-semibold text-slate-500">{question.difficulty} · {question.points} points</div>
        </div>
        <div className="space-y-5 p-5 text-sm leading-6 text-slate-700">
          <p className="whitespace-pre-line">{question.statement}</p>
          <div>
            <h2 className="font-bold text-slate-900">Constraints</h2>
            <p>{question.constraints_text}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <pre className="rounded-md bg-slate-100 p-3"><b>Sample Input</b>{'\n'}{question.sample_input}</pre>
            <pre className="rounded-md bg-slate-100 p-3"><b>Sample Output</b>{'\n'}{question.sample_output}</pre>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="font-bold">Python Editor</div>
          <div className="flex gap-2">
            <button className="btn btn-soft" onClick={() => setDark(!dark)}><SunMoon size={16} /></button>
            <button className="btn btn-soft" onClick={resetCode} disabled={isRunning || isSubmitting}><RotateCcw size={16} /> Reset</button>
            <button className="btn btn-soft" onClick={run} disabled={isRunning || isSubmitting}><Play size={16} /> {isRunning ? 'Running...' : 'Run'}</button>
            <button className="btn btn-primary" onClick={submit} disabled={isRunning || isSubmitting}><Send size={16} /> {isSubmitting ? 'Submitting...' : 'Submit'}</button>
          </div>
        </div>
        {error && <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}
        <CodeMirror value={code} height="430px" theme={dark ? 'dark' : 'light'} extensions={extensions} onChange={setCode} basicSetup={{ lineNumbers: true, indentOnInput: true, foldGutter: true }} />
        <div className="grid gap-3 border-t border-slate-200 p-4 lg:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-sm font-bold">Input</div>
            <textarea className="input min-h-28 font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </label>
          <div>
            <div className="mb-1 text-sm font-bold">Output / Errors</div>
            <pre className="min-h-28 overflow-auto rounded-md bg-slate-950 p-3 text-sm text-slate-50">{output}</pre>
          </div>
        </div>
        {results.length > 0 && (
          <div className="border-t border-slate-200 p-4">
            <div className="mb-2 text-sm font-bold">Test Case Results</div>
            <div className="grid gap-2">
              {results.map((r, i) => (
                <div key={i} className={`rounded-md px-3 py-2 text-sm ${r.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  Case {i + 1} {r.hidden ? '(hidden)' : '(public)'}: {r.passed ? 'Passed' : 'Failed'} {r.error ? `· ${r.error}` : ''}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
