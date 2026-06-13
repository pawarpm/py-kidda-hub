import { useEffect, useState } from 'react';
import { AlertTriangle, FileText, LifeBuoy, Loader2, MessageSquarePlus, Send } from 'lucide-react';
import { api } from '../lib/api';

const categories = ['Technical Bug', 'App Glitch', 'Question/Test Problem', 'Wrong Test Case or Output', 'Abusive Language', 'Misbehavior', 'Group/Chat Issue', 'Account/Login Issue', 'Suggestion', 'General Feedback'];
const priorities = ['Low', 'Medium', 'High', 'Urgent'];

type ReportItem = {
  id: string;
  title: string;
  category: string;
  description: string;
  related_module?: string | null;
  related_question_id?: string | null;
  reported_user_identifier?: string | null;
  priority: string;
  status: string;
  admin_remarks?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  created_at: string;
  comments?: Array<{ id: string; comment: string; is_admin: boolean; authorName?: string; created_at: string }>;
};

const emptyForm = {
  title: '',
  category: 'Technical Bug',
  description: '',
  relatedModule: '',
  relatedQuestionId: '',
  reportedUserIdentifier: '',
  priority: 'Medium',
  attachment: undefined as { name: string; type: string; dataUrl: string } | undefined
};

function statusClass(status: string) {
  if (status === 'Resolved') return 'bg-emerald-50 text-emerald-700';
  if (status === 'Rejected') return 'bg-slate-100 text-slate-600';
  if (status === 'Under Review') return 'bg-blue-50 text-brand';
  return 'bg-amber-50 text-amber-700';
}

function priorityClass(priority: string) {
  if (priority === 'Urgent') return 'border-red-200 bg-red-50 text-red-700';
  if (priority === 'High') return 'border-orange-200 bg-orange-50 text-orange-700';
  if (priority === 'Medium') return 'border-blue-200 bg-blue-50 text-brand';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function readFile(file: File) {
  return new Promise<{ name: string; type: string; dataUrl: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', dataUrl: String(reader.result) });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Reports() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [commentByReport, setCommentByReport] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function loadReports() {
    setLoading(true);
    api<ReportItem[]>('/reports')
      .then(setReports)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load reports.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadReports();
  }, []);

  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api('/reports', { method: 'POST', body: JSON.stringify(form) });
      setForm(emptyForm);
      setMessage('Report submitted successfully. Admin will review it soon.');
      loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report.');
    } finally {
      setSaving(false);
    }
  }

  async function addComment(reportId: string) {
    const comment = commentByReport[reportId]?.trim();
    if (!comment) return;
    await api(`/reports/${reportId}/comments`, { method: 'POST', body: JSON.stringify({ comment }) });
    setCommentByReport({ ...commentByReport, [reportId]: '' });
    loadReports();
  }

  async function handleAttachment(file?: File) {
    if (!file) {
      setForm({ ...form, attachment: undefined });
      return;
    }
    const attachment = await readFile(file);
    setForm({ ...form, attachment });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Report Box / Help & Feedback</h1>
          <p className="text-sm text-slate-500">Report bugs, wrong test cases, chat issues, account problems, or suggestions.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm font-bold text-brand">
          <LifeBuoy size={17} />
          Student support
        </div>
      </div>

      {message && <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{message}</div>}
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div>}

      <form onSubmit={submitReport} className="panel grid gap-3 p-5 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <div className="font-bold">Submit New Report</div>
          <div className="text-sm text-slate-500">Give enough detail so the admin can quickly understand and fix the issue.</div>
        </div>
        <input className="input lg:col-span-2" placeholder="Report title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        <select className="input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
          {categories.map((category) => <option key={category}>{category}</option>)}
        </select>
        <select className="input" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
          {priorities.map((priority) => <option key={priority}>{priority}</option>)}
        </select>
        <input className="input" placeholder="Related module/page" value={form.relatedModule} onChange={(event) => setForm({ ...form, relatedModule: event.target.value })} />
        <input className="input" placeholder="Related question/problem ID, if applicable" value={form.relatedQuestionId} onChange={(event) => setForm({ ...form, relatedQuestionId: event.target.value })} />
        <input className="input lg:col-span-2" placeholder="Reported user username/email, if applicable" value={form.reportedUserIdentifier} onChange={(event) => setForm({ ...form, reportedUserIdentifier: event.target.value })} />
        <textarea className="input min-h-32 lg:col-span-2" placeholder="Detailed description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
        <label className="block lg:col-span-2">
          <span className="mb-1 block text-sm font-semibold">Optional screenshot/file upload</span>
          <input className="input" type="file" accept="image/*,.pdf,text/plain" onChange={(event) => handleAttachment(event.target.files?.[0])} />
          {form.attachment && <span className="mt-1 block text-xs text-slate-500">{form.attachment.name}</span>}
        </label>
        <button className="btn btn-primary lg:col-span-2" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
          {saving ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="font-bold">My Reports</div>
          <div className="text-sm text-slate-500">Track report status and read admin remarks.</div>
        </div>
        {loading && <div className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> Loading reports</div>}
        {!loading && reports.length === 0 && <div className="p-6 text-center text-sm text-slate-500">No reports submitted yet.</div>}
        <div className="divide-y divide-slate-100">
          {reports.map((report) => (
            <div key={report.id} className={`p-4 ${report.priority === 'Urgent' ? 'bg-red-50/40' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-bold">{report.title}</div>
                    <span className={`rounded px-2 py-1 text-xs font-bold ${statusClass(report.status)}`}>{report.status}</span>
                    <span className={`rounded border px-2 py-1 text-xs font-bold ${priorityClass(report.priority)}`}>{report.priority}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{report.category} · {report.related_module || 'No module'} · {new Date(report.created_at).toLocaleString()}</div>
                </div>
                {report.attachment_url && (
                  <a className="btn btn-soft" href={report.attachment_url} target="_blank" rel="noreferrer">
                    <FileText size={16} />
                    Attachment
                  </a>
                )}
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{report.description}</p>
              {report.admin_remarks && (
                <div className="mt-3 rounded-md bg-blue-50 p-3 text-sm text-brand">
                  <b>Admin remarks:</b> {report.admin_remarks}
                </div>
              )}
              {(report.category.includes('Abusive') || report.category.includes('Misbehavior') || report.category.includes('Group/Chat')) && (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
                  <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                  Reporter identity is private from the reported user. Admin can review related context if available.
                </div>
              )}
              <div className="mt-3 space-y-2">
                {(report.comments || []).map((comment) => (
                  <div key={comment.id} className={`rounded-md p-2 text-sm ${comment.is_admin ? 'bg-blue-50 text-brand' : 'bg-slate-50 text-slate-700'}`}>
                    <b>{comment.is_admin ? 'Admin' : comment.authorName || 'You'}:</b> {comment.comment}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input className="input" placeholder="Add follow-up comment" value={commentByReport[report.id] || ''} onChange={(event) => setCommentByReport({ ...commentByReport, [report.id]: event.target.value })} />
                <button className="btn btn-soft" type="button" onClick={() => addComment(report.id)}>
                  <MessageSquarePlus size={16} />
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
