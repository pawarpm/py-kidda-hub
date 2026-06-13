import { useEffect, useMemo, useState } from 'react';
import { Camera, Eye, EyeOff, Loader2, MapPin, Phone, Save, UserRound } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getUser, saveSession } from '../lib/api';

type StudentProfile = {
  fullName: string;
  profilePictureUrl?: string | null;
  basicInfo: string;
  bio: string;
  phone: string;
  location: string;
  dateOfBirth: string;
  gender: string;
  isProgressPublic: boolean;
};

const blankProfile: StudentProfile = {
  fullName: '',
  profilePictureUrl: '',
  basicInfo: '',
  bio: '',
  phone: '',
  location: '',
  dateOfBirth: '',
  gender: '',
  isProgressPublic: false
};

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

export default function ProfileForm() {
  const user = getUser();
  const { mode } = useParams();
  const isEdit = mode === 'edit';
  const navigate = useNavigate();
  const [form, setForm] = useState<StudentProfile>({ ...blankProfile, fullName: user?.name || '' });
  const [picture, setPicture] = useState<{ name: string; type: string; dataUrl: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const previewUrl = useMemo(() => picture?.dataUrl || form.profilePictureUrl || user?.avatar_url || '', [form.profilePictureUrl, picture, user?.avatar_url]);

  useEffect(() => {
    if (!isEdit && user?.id) localStorage.setItem(`pkh-profile-create-shown:${user.id}`, 'true');
    let active = true;
    api<{ exists: boolean; profile: StudentProfile | null }>('/student-profile')
      .then((result) => {
        if (!active) return;
        if (result.profile) setForm({ ...blankProfile, ...result.profile, fullName: result.profile.fullName || user?.name || '' });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load profile.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [isEdit, user?.id, user?.name]);

  async function choosePicture(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Profile picture should be an image file.');
      event.target.value = '';
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Profile picture must be smaller than 3 MB.');
      event.target.value = '';
      return;
    }
    const dataUrl = await readImage(file);
    setPicture({ name: file.name, type: file.type, dataUrl });
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!form.fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    if (form.phone && !/^[+]?[\d\s-]{10,15}$/.test(form.phone)) {
      setError('Enter a valid phone number.');
      return;
    }
    setSaving(true);
    try {
      const result = await api<{ profile: StudentProfile; user: any }>('/student-profile', {
        method: 'PUT',
        body: JSON.stringify({ ...form, profilePicture: picture })
      });
      if (user) saveSession(localStorage.getItem('token') || '', { ...user, ...result.user });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="panel flex min-h-80 items-center justify-center p-8 text-slate-600">
        <Loader2 className="mr-2 animate-spin" size={18} />
        Loading profile
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <form onSubmit={saveProfile} className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
        <section className="panel p-5">
          <div className="text-sm font-bold text-brand">{isEdit ? 'Edit Profile' : 'Create Profile'}</div>
          <h1 className="mt-1 text-2xl font-bold tracking-normal">{isEdit ? 'Update your student profile' : 'Complete your student profile'}</h1>
          <p className="mt-2 text-sm text-slate-600">This profile keeps your personal details and progress connected to your own account.</p>

          <div className="mt-6 flex flex-col items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-white text-slate-400 shadow-sm">
              {previewUrl ? <img className="h-full w-full object-cover" src={previewUrl} alt="Profile preview" /> : <UserRound size={40} />}
            </div>
            <label className="btn btn-soft mt-4 cursor-pointer">
              <Camera size={16} />
              Upload Photo
              <input className="hidden" type="file" accept="image/*" onChange={choosePicture} />
            </label>
            <div className="mt-2 text-xs text-slate-500">JPG, PNG, or WebP under 3 MB</div>
          </div>
        </section>

        <section className="panel p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <UserRound size={15} /> Full name
              </span>
              <input className="input" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1 text-sm font-semibold">Basic information</span>
              <input className="input" value={form.basicInfo} onChange={(event) => setForm({ ...form, basicInfo: event.target.value })} placeholder="Second-year B.Tech student, branch, division, or roll number" />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1 text-sm font-semibold">Short bio / About</span>
              <textarea className="input min-h-28 resize-y" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="Write a short introduction about yourself." />
            </label>

            <label className="block">
              <span className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <Phone size={15} /> Phone number
              </span>
              <input className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+91 98765 43210" />
            </label>

            <label className="block">
              <span className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <MapPin size={15} /> Address or location
              </span>
              <input className="input" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="City, State" />
            </label>

            <label className="block">
              <span className="mb-1 text-sm font-semibold">Date of birth</span>
              <input className="input" type="date" value={form.dateOfBirth || ''} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} />
            </label>

            <label className="block">
              <span className="mb-1 text-sm font-semibold">Gender</span>
              <select className="input" value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}>
                <option value="">Select gender</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
                <option>Prefer not to say</option>
              </select>
            </label>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 md:col-span-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    {form.isProgressPublic ? <Eye size={16} /> : <EyeOff size={16} />}
                    Show my progress publicly
                  </div>
                  <p className="mt-1 text-sm text-slate-600">Private is the default. When private, other students can see only your name, photo, and status.</p>
                </div>
                <div className="grid grid-cols-2 rounded-md bg-white p-1 shadow-sm">
                  <button
                    className={`rounded px-4 py-2 text-sm font-bold ${form.isProgressPublic ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    type="button"
                    onClick={() => setForm({ ...form, isProgressPublic: true })}
                  >
                    Yes
                  </button>
                  <button
                    className={`rounded px-4 py-2 text-sm font-bold ${!form.isProgressPublic ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    type="button"
                    onClick={() => setForm({ ...form, isProgressPublic: false })}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          </div>

          {error && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button className="btn btn-soft" type="button" onClick={() => navigate('/')}>
              {isEdit ? 'Cancel' : 'Skip for Now'}
            </button>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              {saving ? 'Saving Profile' : isEdit ? 'Save Changes' : 'Create Profile'}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
