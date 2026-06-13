import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { query } from './db.js';
import { requireAdmin, requireAuth, signToken } from './auth.js';
import { executePython, normalizeOutput } from './executor.js';
import { buildQuestionSeed } from './questions.js';

const app = express();
const port = Number(process.env.PORT || 4000);
let memoryMode = process.env.MEMORY_MODE === 'true';

type MemoryUser = {
  id: string;
  name: string;
  email: string;
  password_hash?: string;
  auth_provider: 'password' | 'google';
  google_sub?: string;
  avatar_url?: string;
  role: 'student' | 'admin';
  college: string;
  status: 'online' | 'idle' | 'offline';
  last_active_at?: Date | null;
};

type MemoryQuestion = ReturnType<typeof createMemoryQuestion>;
type MemoryStudentProfile = {
  user_id: string;
  full_name: string;
  profile_picture_url?: string | null;
  basic_info?: string | null;
  bio?: string | null;
  phone?: string | null;
  location?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  is_progress_public: boolean;
};

const memoryUsers: MemoryUser[] = [
  {
    id: randomUUID(),
    name: 'Demo Student',
    email: 'student@example.com',
    password_hash: bcrypt.hashSync('Student@123', 10),
    auth_provider: 'password',
    college: 'Demo Engineering College',
    role: 'student',
    status: 'offline',
    last_active_at: null
  },
  {
    id: randomUUID(),
    name: 'Admin Faculty',
    email: 'admin@example.com',
    password_hash: bcrypt.hashSync('Admin@123', 10),
    auth_provider: 'password',
    college: 'Demo Engineering College',
    role: 'admin',
    status: 'offline',
    last_active_at: null
  }
];

const memorySubmissions: Array<{ user_id: string; question_id: string; score: number; created_at: Date }> = [];
const memoryStudentProfiles = new Map<string, MemoryStudentProfile>();
const memoryMockTests = [
  { id: randomUUID(), title: '30-Minute Python Sprint', duration_minutes: 30 },
  { id: randomUUID(), title: '60-Minute Practical Test', duration_minutes: 60 },
  { id: randomUUID(), title: '90-Minute Placement Practice', duration_minutes: 90 },
  { id: randomUUID(), title: 'Full Semester Python Practice', duration_minutes: 180 }
];
const memoryMockAttempts = new Map<
  string,
  {
    id: string;
    user_id: string;
    mock_test_id: string;
    question_ids: string[];
    started_at: Date;
    ends_at: Date;
    status: 'in_progress' | 'submitted' | 'auto_submitted';
  }
>();
const memoryFriendRequests: Array<{ id: string; sender_id: string; receiver_id: string; status: 'pending' | 'accepted' | 'rejected'; created_at: Date; responded_at?: Date | null }> = [];
const memoryFriends: Array<{ user_id: string; friend_id: string; created_at: Date }> = [];
const memoryPrivateChats: Array<{ id: string; user_one_id: string; user_two_id: string; created_at: Date }> = [];
const memoryPrivateMessages: Array<{ id: string; chat_id: string; sender_id: string; message_text: string; read_at?: Date | null; created_at: Date }> = [];
const memoryGroups: Array<{ id: string; name: string; picture_url?: string | null; created_by: string; created_at: Date; updated_at: Date }> = [];
const memoryGroupMembers: Array<{ group_id: string; user_id: string; is_admin: boolean; joined_at: Date }> = [];
const memoryGroupMessages: Array<{ id: string; group_id: string; sender_id: string; message_text: string; created_at: Date }> = [];
const notificationTypes = ['Feature Update', 'App Change', 'Announcement', 'Maintenance', 'General'] as const;
const notificationPriorities = ['Low', 'Medium', 'High'] as const;
const notificationTargets = ['All Users', 'Students', 'Admins', 'Specific User'] as const;
const notificationStatuses = ['Draft', 'Published'] as const;
type MemoryNotification = {
  id: string;
  title: string;
  message: string;
  type: (typeof notificationTypes)[number];
  priority: (typeof notificationPriorities)[number];
  target: (typeof notificationTargets)[number];
  specific_user_id?: string | null;
  publish_at: Date;
  expires_at?: Date | null;
  status: (typeof notificationStatuses)[number];
  created_by: string;
  created_at: Date;
  updated_at: Date;
};
const memoryNotificationReads: Array<{ notification_id: string; user_id: string; read_at?: Date | null; cleared_at?: Date | null }> = [];
const memoryNotifications: MemoryNotification[] = [];

function createMemoryQuestion(seed: {
  title: string;
  slug: string;
  category: string;
  topic: string;
  difficulty: string;
  statement: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  starterCode: string;
  points: number;
  cases: Array<{ input: string; output: string; hidden: boolean }>;
}) {
  return {
    id: randomUUID(),
    title: seed.title,
    slug: seed.slug,
    category: seed.category,
    topic: seed.topic,
    difficulty: seed.difficulty,
    statement: seed.statement,
    constraints_text: seed.constraints,
    sample_input: seed.sampleInput,
    sample_output: seed.sampleOutput,
    starter_code: seed.starterCode,
    points: seed.points,
    cases: seed.cases.map((testCase) => ({
      id: randomUUID(),
      input_data: testCase.input,
      expected_output: testCase.output,
      is_hidden: testCase.hidden,
      weight: 1
    }))
  };
}

const memoryQuestions = buildQuestionSeed().map(createMemoryQuestion);
const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');

function publicUser(user: MemoryUser) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, college: user.college, avatar_url: user.avatar_url || null, status: currentStatus(user), last_active_at: user.last_active_at || null };
}

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required.'),
  basicInfo: z.string().trim().max(500).optional().or(z.literal('')),
  bio: z.string().trim().max(1000).optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  location: z.string().trim().max(250).optional().or(z.literal('')),
  dateOfBirth: z.string().trim().optional().or(z.literal('')),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say']).optional().or(z.literal('')),
  isProgressPublic: z.boolean().optional().default(false),
  profilePicture: z
    .object({
      name: z.string(),
      type: z.string(),
      dataUrl: z.string()
    })
    .optional()
});

function validateProfileBody(body: unknown) {
  const parsed = profileSchema.parse(body);
  const phone = parsed.phone || '';
  if (phone && !/^[+]?[\d\s-]{10,15}$/.test(phone)) {
    throw new Error('Enter a valid phone number.');
  }
  if (parsed.dateOfBirth && Number.isNaN(Date.parse(parsed.dateOfBirth))) {
    throw new Error('Enter a valid date of birth.');
  }
  if (parsed.profilePicture && !parsed.profilePicture.type.startsWith('image/')) {
    throw new Error('Profile picture should be an image file.');
  }
  return parsed;
}

function toCamelProfile(profile: MemoryStudentProfile | Record<string, unknown>) {
  const rawDateOfBirth = profile.date_of_birth;
  const dateOfBirth =
    rawDateOfBirth instanceof Date
      ? rawDateOfBirth.toISOString().slice(0, 10)
      : typeof rawDateOfBirth === 'string'
        ? rawDateOfBirth.slice(0, 10)
        : '';
  return {
    fullName: profile.full_name,
    profilePictureUrl: profile.profile_picture_url || null,
    basicInfo: profile.basic_info || '',
    bio: profile.bio || '',
    phone: profile.phone || '',
    location: profile.location || '',
    dateOfBirth,
    gender: profile.gender || '',
    isProgressPublic: Boolean(profile.is_progress_public)
  };
}

function currentStatus(user: { status?: string | null; last_active_at?: Date | string | null }) {
  if (user.status === 'offline') return 'offline';
  const lastActive = user.last_active_at ? new Date(user.last_active_at).getTime() : 0;
  if (!lastActive) return user.status || 'offline';
  const inactiveMs = Date.now() - lastActive;
  if (inactiveMs > 5 * 60 * 1000) return 'offline';
  if (inactiveMs > 90 * 1000) return 'idle';
  return user.status || 'online';
}

function progressSummary(userId: string) {
  const own = memorySubmissions.filter((submission) => submission.user_id === userId);
  const solvedIds = new Set(own.filter((submission) => submission.score === 100).map((submission) => submission.question_id));
  const totalScore = own.reduce((sum, submission) => {
    const question = memoryQuestions.find((item) => item.id === submission.question_id);
    return sum + Math.round(((question?.points || 0) * submission.score) / 100);
  }, 0);
  const completedTopics = Array.from(
    new Set(
      own
        .filter((submission) => submission.score === 100)
        .map((submission) => memoryQuestions.find((question) => question.id === submission.question_id)?.topic)
        .filter(Boolean)
    )
  );
  const recent = [...own].sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0];
  const badges = [
    solvedIds.size >= 1 ? 'First Solve' : '',
    solvedIds.size >= 5 ? 'Python Sprinter' : '',
    totalScore >= 100 ? 'Century Coder' : ''
  ].filter(Boolean);
  return {
    solvedProblems: solvedIds.size,
    totalScore,
    completedTopics,
    badges,
    ranking: null,
    recentActivity: recent ? recent.created_at : null
  };
}

async function saveProfilePicture(userId: string, picture?: { name: string; type: string; dataUrl: string }) {
  if (!picture) return undefined;
  if (!picture.type.startsWith('image/')) throw new Error('Profile picture should be an image file.');
  const match = picture.dataUrl.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('Profile picture upload is invalid.');
  const extension = match[1].replace('jpeg', 'jpg').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'jpg';
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.byteLength > 3 * 1024 * 1024) throw new Error('Profile picture must be smaller than 3 MB.');
  await fs.mkdir(uploadDir, { recursive: true });
  const filename = `${userId}-${randomUUID()}.${extension}`;
  await fs.writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/${filename}`;
}

function studentCard(userId: string) {
  const user = memoryUsers.find((item) => item.id === userId);
  if (!user) return null;
  const profile = memoryStudentProfiles.get(userId);
  return {
    id: user.id,
    name: profile?.full_name || user.name,
    profilePictureUrl: profile?.profile_picture_url || user.avatar_url || null,
    status: currentStatus(user),
    college: user.college
  };
}

function areMemoryFriends(userId: string, friendId: string) {
  return memoryFriends.some((friendship) => friendship.user_id === userId && friendship.friend_id === friendId);
}

function ensureMemoryFriend(userId: string, friendId: string) {
  if (!areMemoryFriends(userId, friendId)) throw new Error('Only friends can chat with each other.');
}

function findOrCreateMemoryChat(userId: string, friendId: string) {
  const existing = memoryPrivateChats.find(
    (chat) => (chat.user_one_id === userId && chat.user_two_id === friendId) || (chat.user_one_id === friendId && chat.user_two_id === userId)
  );
  if (existing) return existing;
  const chat = { id: randomUUID(), user_one_id: userId, user_two_id: friendId, created_at: new Date() };
  memoryPrivateChats.push(chat);
  return chat;
}

function memoryGroupMember(groupId: string, userId: string) {
  return memoryGroupMembers.find((member) => member.group_id === groupId && member.user_id === userId);
}

function ensureMemoryGroupMember(groupId: string, userId: string) {
  const member = memoryGroupMember(groupId, userId);
  if (!member) throw new Error('You can access only groups where you are a member.');
  return member;
}

function ensureMemoryGroupAdmin(groupId: string, userId: string) {
  const member = ensureMemoryGroupMember(groupId, userId);
  if (!member.is_admin) throw new Error('Only group admins can perform this action.');
  return member;
}

function groupView(groupId: string) {
  const group = memoryGroups.find((item) => item.id === groupId);
  if (!group) return null;
  const members = memoryGroupMembers
    .filter((member) => member.group_id === group.id)
    .map((member) => ({ ...studentCard(member.user_id), isAdmin: member.is_admin }))
    .filter((member) => member.id);
  const latest = [...memoryGroupMessages].filter((message) => message.group_id === group.id).sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0];
  return { ...group, members, latestMessage: latest || null };
}

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || '';
}

function notificationApplies(notification: MemoryNotification, user: { id: string; role: 'student' | 'admin' }) {
  if (notification.status !== 'Published') return false;
  if (notification.publish_at > new Date()) return false;
  if (notification.expires_at && notification.expires_at < new Date()) return false;
  if (notification.target === 'All Users') return true;
  if (notification.target === 'Students') return user.role === 'student';
  if (notification.target === 'Admins') return user.role === 'admin';
  return notification.specific_user_id === user.id;
}

function memoryNotificationForUser(notification: MemoryNotification, userId: string) {
  const state = memoryNotificationReads.find((item) => item.notification_id === notification.id && item.user_id === userId);
  return {
    ...notification,
    isRead: Boolean(state?.read_at),
    isCleared: Boolean(state?.cleared_at),
    readAt: state?.read_at || null,
    createdByName: memoryUsers.find((user) => user.id === notification.created_by)?.name || 'Admin'
  };
}

function notificationReadCount(notificationId: string) {
  return memoryNotificationReads.filter((item) => item.notification_id === notificationId && item.read_at).length;
}

function defaultNotifications() {
  return [
    { title: 'Welcome to Py Kidda Hub', message: 'Welcome to PY Kidda Hub(PKH). Start practicing Python and track your progress.', type: 'Announcement' as const, priority: 'High' as const },
    { title: 'New Python Practice Tests Added', message: 'Fresh Python practice tests are now available in the question bank and mock test sections.', type: 'Feature Update' as const, priority: 'Medium' as const },
    { title: 'Progress Tracking Feature Updated', message: 'Student dashboards now show improved progress and activity tracking.', type: 'App Change' as const, priority: 'Medium' as const },
    { title: 'Friends and Groups Feature Added', message: 'You can now add friends, send private messages, create study groups, and discuss Python doubts with classmates.', type: 'Feature Update' as const, priority: 'High' as const },
    { title: 'Notification Center Added', message: 'A new bell icon now shows announcements, feature updates, maintenance messages, and important app changes for every user.', type: 'Feature Update' as const, priority: 'High' as const }
  ];
}

function seedNotifications() {
  const admin = memoryUsers.find((user) => user.role === 'admin') || memoryUsers[0];
  for (const sample of defaultNotifications()) {
    if (memoryNotifications.some((notification) => notification.title === sample.title)) continue;
    memoryNotifications.push({
      id: randomUUID(),
      ...sample,
      target: 'All Users',
      specific_user_id: null,
      publish_at: new Date(Date.now() - 60_000),
      expires_at: null,
      status: 'Published',
      created_by: admin.id,
      created_at: new Date(),
      updated_at: new Date()
    });
  }
}

async function ensureDefaultNotifications() {
  const admin = await query("SELECT id FROM users WHERE role='admin' ORDER BY created_at LIMIT 1");
  const adminId = admin.rows[0]?.id;
  if (!adminId) return;
  for (const sample of defaultNotifications()) {
    await query(
      `INSERT INTO notifications (title,message,type,priority,target,publish_at,status,created_by)
       SELECT $1,$2,$3,$4,'All Users',now(),'Published',$5
       WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE title=$1)`,
      [sample.title, sample.message, sample.type, sample.priority, adminId]
    );
  }
}

type GoogleProfile = {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  aud: string;
};

async function verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Google sign-in is not configured. Add GOOGLE_CLIENT_ID to server/.env and VITE_GOOGLE_CLIENT_ID to client/.env.');
  }
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!response.ok) {
    throw new Error('Google sign-in could not verify this account.');
  }
  const profile = (await response.json()) as GoogleProfile;
  if (profile.aud !== clientId) {
    throw new Error('Google sign-in client ID mismatch.');
  }
  if (!profile.email_verified) {
    throw new Error('Please use a verified Google account.');
  }
  return profile;
}

function isConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : '';
  return code === 'ECONNREFUSED' || code === 'ENOTFOUND' || message.includes('ECONNREFUSED') || message.includes('database');
}

async function preferMemory() {
  if (memoryMode) return true;
  try {
    await query('SELECT 1');
    return false;
  } catch (error) {
    if (isConnectionError(error)) {
      memoryMode = true;
      console.warn('PostgreSQL is unavailable. Falling back to in-memory demo mode.');
      return true;
    }
    throw error;
  }
}

const asyncRoute =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

const notificationSchema = z.object({
  title: z.string().trim().min(3).max(140),
  message: z.string().trim().min(5).max(2000),
  type: z.enum(notificationTypes),
  priority: z.enum(notificationPriorities),
  target: z.enum(notificationTargets),
  specificUserId: z.string().uuid().optional().or(z.literal('')),
  publishAt: z.string().min(1),
  expiresAt: z.string().optional().or(z.literal('')),
  status: z.enum(notificationStatuses)
});

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173' }));
app.use(express.json({ limit: '4mb' }));
app.use('/uploads', express.static(uploadDir));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'python-test-platform' }));

app.get('/api/auth/config', (_req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
});

app.post('/api/auth/google', asyncRoute(async (req, res) => {
  const body = z.object({ credential: z.string().min(20), college: z.string().min(2).optional() }).parse(req.body);
  const profile = await verifyGoogleCredential(body.credential);
  const email = profile.email.toLowerCase();

  if (await preferMemory()) {
    let user = memoryUsers.find((item) => item.google_sub === profile.sub || item.email === email);
    if (user) {
      user.name = profile.name || user.name;
      user.email = email;
      user.auth_provider = 'google';
      user.google_sub = profile.sub;
      user.avatar_url = profile.picture;
    } else {
      user = {
        id: randomUUID(),
        name: profile.name,
        email,
        auth_provider: 'google',
        google_sub: profile.sub,
        avatar_url: profile.picture,
        college: body.college || 'Demo Engineering College',
        role: 'student',
        status: 'online',
        last_active_at: new Date()
      };
      memoryUsers.push(user);
    }
    user.status = 'online';
    user.last_active_at = new Date();
    const tokenUser = publicUser(user);
    return res.status(201).json({ token: signToken(tokenUser), user: tokenUser });
  }

  const existing = await query('SELECT * FROM users WHERE google_sub=$1 OR email=$2 LIMIT 1', [profile.sub, email]);
  if (existing.rows[0]) {
    const updated = await query(
      `UPDATE users
       SET name=$1, email=$2, auth_provider='google', google_sub=$3, avatar_url=$4, status='online', last_active_at=now()
       WHERE id=$5
       RETURNING id,name,email,role,college,avatar_url,status,last_active_at`,
      [profile.name, email, profile.sub, profile.picture || null, existing.rows[0].id]
    );
    const user = updated.rows[0];
    return res.json({ token: signToken(user), user });
  }

  const inserted = await query(
    `INSERT INTO users (name, email, auth_provider, google_sub, avatar_url, college)
     VALUES ($1,$2,'google',$3,$4,$5)
     RETURNING id,name,email,role,college,avatar_url,status,last_active_at`,
    [profile.name, email, profile.sub, profile.picture || null, body.college || 'Demo Engineering College']
  );
  const user = inserted.rows[0];
  res.status(201).json({ token: signToken(user), user });
}));

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const body = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), college: z.string().min(2) }).parse(req.body);
  const passwordHash = await bcrypt.hash(body.password, 10);
  if (await preferMemory()) {
    const email = body.email.toLowerCase();
    if (memoryUsers.some((user) => user.email === email)) {
      return res.status(409).json({ message: 'Email is already registered' });
    }
    const user: MemoryUser = { id: randomUUID(), name: body.name, email, password_hash: passwordHash, auth_provider: 'password', college: body.college, role: 'student', status: 'online', last_active_at: new Date() };
    memoryUsers.push(user);
    const tokenUser = publicUser(user);
    return res.status(201).json({ token: signToken(tokenUser), user: tokenUser });
  }
  const result = await query(
    `INSERT INTO users (name, email, password_hash, college, status, last_active_at)
     VALUES ($1,$2,$3,$4,'online',now())
     RETURNING id,name,email,role,college,avatar_url,status,last_active_at`,
    [body.name, body.email.toLowerCase(), passwordHash, body.college]
  );
  const user = result.rows[0];
  res.status(201).json({ token: signToken(user), user });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
  if (await preferMemory()) {
    const user = memoryUsers.find((item) => item.email === body.email.toLowerCase());
    if (!user || !user.password_hash || !(await bcrypt.compare(body.password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    user.status = 'online';
    user.last_active_at = new Date();
    const tokenUser = publicUser(user);
    return res.json({ token: signToken(tokenUser), user: tokenUser });
  }
  const result = await query('SELECT * FROM users WHERE email=$1', [body.email.toLowerCase()]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  const updated = await query('UPDATE users SET status=$1, last_active_at=now() WHERE id=$2 RETURNING id,name,email,role,college,avatar_url,status,last_active_at', ['online', user.id]);
  const tokenUser = updated.rows[0];
  res.json({ token: signToken(tokenUser), user: tokenUser });
}));

app.post('/api/auth/forgot-password', (_req, res) => {
  res.json({ message: 'If the email exists, a password reset link will be sent by the configured mail service.' });
});

app.get('/api/profile', requireAuth, asyncRoute(async (req, res) => {
  if (await preferMemory()) {
    const own = memorySubmissions.filter((submission) => submission.user_id === req.user!.id);
    const solved = new Set(own.map((submission) => submission.question_id)).size;
    const accuracy = own.length ? Math.round(own.reduce((sum, item) => sum + item.score, 0) / own.length) : 0;
    return res.json({ user: req.user, stats: { attempts: own.length, solved, accuracy } });
  }
  const stats = await query(
    `SELECT count(*)::int AS attempts,
            count(DISTINCT question_id)::int AS solved,
            coalesce(round(avg(score),2),0) AS accuracy
     FROM submissions WHERE user_id=$1`,
    [req.user!.id]
  );
  res.json({ user: req.user, stats: stats.rows[0] });
}));

app.get('/api/student-profile', requireAuth, asyncRoute(async (req, res) => {
  if (await preferMemory()) {
    const profile = memoryStudentProfiles.get(req.user!.id);
    return res.json({ exists: Boolean(profile), profile: profile ? toCamelProfile(profile) : null });
  }
  const result = await query('SELECT * FROM student_profiles WHERE user_id=$1', [req.user!.id]);
  const profile = result.rows[0];
  res.json({ exists: Boolean(profile), profile: profile ? toCamelProfile(profile) : null });
}));

app.put('/api/student-profile', requireAuth, asyncRoute(async (req, res) => {
  const body = validateProfileBody(req.body);
  const pictureUrl = await saveProfilePicture(req.user!.id, body.profilePicture);
  const payload = {
    user_id: req.user!.id,
    full_name: body.fullName,
    profile_picture_url: pictureUrl,
    basic_info: body.basicInfo || null,
    bio: body.bio || null,
    phone: body.phone || null,
    location: body.location || null,
    date_of_birth: body.dateOfBirth || null,
    gender: body.gender || null,
    is_progress_public: Boolean(body.isProgressPublic)
  };

  if (await preferMemory()) {
    const current = memoryStudentProfiles.get(req.user!.id);
    const profile: MemoryStudentProfile = {
      ...payload,
      profile_picture_url: pictureUrl ?? current?.profile_picture_url ?? null
    };
    memoryStudentProfiles.set(req.user!.id, profile);
    const user = memoryUsers.find((item) => item.id === req.user!.id);
    if (user) {
      user.name = body.fullName;
      if (profile.profile_picture_url) user.avatar_url = profile.profile_picture_url;
    }
    const tokenUser = user ? publicUser(user) : { ...req.user!, name: body.fullName, avatar_url: profile.profile_picture_url };
    return res.json({ profile: toCamelProfile(profile), user: tokenUser });
  }

  const result = await query(
    `INSERT INTO student_profiles (user_id, full_name, profile_picture_url, basic_info, bio, phone, location, date_of_birth, gender, is_progress_public)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (user_id) DO UPDATE SET
       full_name=excluded.full_name,
       profile_picture_url=coalesce(excluded.profile_picture_url, student_profiles.profile_picture_url),
       basic_info=excluded.basic_info,
       bio=excluded.bio,
       phone=excluded.phone,
       location=excluded.location,
       date_of_birth=excluded.date_of_birth,
       gender=excluded.gender,
       is_progress_public=excluded.is_progress_public,
       updated_at=now()
     RETURNING *`,
    [
      payload.user_id,
      payload.full_name,
      payload.profile_picture_url,
      payload.basic_info,
      payload.bio,
      payload.phone,
      payload.location,
      payload.date_of_birth,
      payload.gender,
      payload.is_progress_public
    ]
  );
  const profile = result.rows[0];
  const userResult = await query(
    `UPDATE users
     SET name=$1, avatar_url=coalesce($2, avatar_url), last_active_at=now()
     WHERE id=$3
     RETURNING id,name,email,role,college,avatar_url`,
    [body.fullName, profile.profile_picture_url, req.user!.id]
  );
  res.json({ profile: toCamelProfile(profile), user: userResult.rows[0] });
}));

app.post('/api/me/status', requireAuth, asyncRoute(async (req, res) => {
  const body = z.object({ status: z.enum(['online', 'idle', 'offline']) }).parse(req.body);
  if (await preferMemory()) {
    const user = memoryUsers.find((item) => item.id === req.user!.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.status = body.status;
    user.last_active_at = new Date();
    return res.json({ status: currentStatus(user), lastActiveAt: user.last_active_at });
  }
  const result = await query(
    'UPDATE users SET status=$1, last_active_at=now() WHERE id=$2 RETURNING status,last_active_at',
    [body.status, req.user!.id]
  );
  res.json({ status: currentStatus(result.rows[0]), lastActiveAt: result.rows[0].last_active_at });
}));

app.post('/api/auth/logout', requireAuth, asyncRoute(async (req, res) => {
  if (await preferMemory()) {
    const user = memoryUsers.find((item) => item.id === req.user!.id);
    if (user) {
      user.status = 'offline';
      user.last_active_at = new Date();
    }
    return res.status(204).end();
  }
  await query('UPDATE users SET status=$1, last_active_at=now() WHERE id=$2', ['offline', req.user!.id]);
  res.status(204).end();
}));

app.get('/api/students/search', requireAuth, asyncRoute(async (req, res) => {
  const search = String(req.query.q || '').trim().toLowerCase();
  if (!search) return res.json([]);

  if (await preferMemory()) {
    const rows = memoryUsers
      .filter((user) => user.role === 'student' && user.id !== req.user!.id)
      .map((user) => {
        const profile = memoryStudentProfiles.get(user.id);
        const name = profile?.full_name || user.name;
        return { user, profile, name };
      })
      .filter((item) => item.name.toLowerCase().includes(search))
      .slice(0, 12)
      .map(({ user, profile, name }) => {
        const isProgressPublic = Boolean(profile?.is_progress_public);
        return {
          id: user.id,
          name,
          profilePictureUrl: profile?.profile_picture_url || user.avatar_url || null,
          status: currentStatus(user),
          isProgressPublic,
          progress: isProgressPublic ? progressSummary(user.id) : null
        };
      });
    return res.json(rows);
  }

  const people = await query(
    `SELECT u.id,
            coalesce(sp.full_name, u.name) AS name,
            coalesce(sp.profile_picture_url, u.avatar_url) AS "profilePictureUrl",
            u.status,
            u.last_active_at,
            coalesce(sp.is_progress_public, false) AS "isProgressPublic"
     FROM users u
     LEFT JOIN student_profiles sp ON sp.user_id=u.id
     WHERE u.role='student'
       AND u.id<>$1
       AND coalesce(sp.full_name, u.name) ILIKE '%' || $2 || '%'
     ORDER BY coalesce(sp.full_name, u.name)
     LIMIT 12`,
    [req.user!.id, search]
  );

  const rows = [];
  for (const person of people.rows) {
    let progress = null;
    if (person.isProgressPublic) {
      const summary = await query(
        `SELECT count(DISTINCT CASE WHEN s.score = 100 THEN s.question_id END)::int AS "solvedProblems",
                coalesce(sum(q.points * s.score / 100),0)::int AS "totalScore",
                coalesce(array_agg(DISTINCT q.topic) FILTER (WHERE s.score = 100), '{}') AS "completedTopics",
                max(s.created_at) AS "recentActivity"
         FROM submissions s
         JOIN questions q ON q.id=s.question_id
         WHERE s.user_id=$1`,
        [person.id]
      );
      const data = summary.rows[0];
      const solvedProblems = Number(data.solvedProblems || 0);
      const totalScore = Number(data.totalScore || 0);
      progress = {
        solvedProblems,
        totalScore,
        completedTopics: data.completedTopics || [],
        badges: [
          solvedProblems >= 1 ? 'First Solve' : '',
          solvedProblems >= 5 ? 'Python Sprinter' : '',
          totalScore >= 100 ? 'Century Coder' : ''
        ].filter(Boolean),
        ranking: null,
        recentActivity: data.recentActivity || null
      };
    }
    rows.push({
      id: person.id,
      name: person.name,
      profilePictureUrl: person.profilePictureUrl,
      status: currentStatus({ status: person.status, last_active_at: person.last_active_at }),
      isProgressPublic: person.isProgressPublic,
      progress
    });
  }
  res.json(rows);
}));

app.get('/api/friends/search', requireAuth, asyncRoute(async (req, res) => {
  const search = String(req.query.q || '').trim().toLowerCase();
  if (!search) return res.json([]);
  if (await preferMemory()) {
    return res.json(
      memoryUsers
        .filter((user) => user.role === 'student' && user.id !== req.user!.id)
        .map((user) => ({ user, card: studentCard(user.id) }))
        .filter((item) => item.card?.name.toLowerCase().includes(search))
        .slice(0, 20)
        .map(({ user, card }) => {
          const sent = memoryFriendRequests.find((request) => request.sender_id === req.user!.id && request.receiver_id === user.id && request.status === 'pending');
          const received = memoryFriendRequests.find((request) => request.sender_id === user.id && request.receiver_id === req.user!.id && request.status === 'pending');
          return {
            ...card,
            relationship: areMemoryFriends(req.user!.id, user.id) ? 'friends' : sent ? 'request_sent' : received ? 'request_received' : 'none',
            requestId: sent?.id || received?.id || null
          };
        })
    );
  }
  const rows = await query(
    `SELECT u.id,
            coalesce(sp.full_name, u.name) AS name,
            coalesce(sp.profile_picture_url, u.avatar_url) AS "profilePictureUrl",
            u.status,
            u.last_active_at,
            CASE
              WHEN f.friend_id IS NOT NULL THEN 'friends'
              WHEN sent.id IS NOT NULL THEN 'request_sent'
              WHEN received.id IS NOT NULL THEN 'request_received'
              ELSE 'none'
            END AS relationship,
            coalesce(sent.id, received.id) AS "requestId"
     FROM users u
     LEFT JOIN student_profiles sp ON sp.user_id=u.id
     LEFT JOIN friends f ON f.user_id=$1 AND f.friend_id=u.id
     LEFT JOIN friend_requests sent ON sent.sender_id=$1 AND sent.receiver_id=u.id AND sent.status='pending'
     LEFT JOIN friend_requests received ON received.sender_id=u.id AND received.receiver_id=$1 AND received.status='pending'
     WHERE u.role='student' AND u.id<>$1 AND coalesce(sp.full_name, u.name) ILIKE '%' || $2 || '%'
     ORDER BY coalesce(sp.full_name, u.name) LIMIT 20`,
    [req.user!.id, search]
  );
  res.json(rows.rows.map((row) => ({ ...row, status: currentStatus({ status: row.status, last_active_at: row.last_active_at }) })));
}));

app.get('/api/friend-requests', requireAuth, asyncRoute(async (req, res) => {
  if (await preferMemory()) {
    const incoming = memoryFriendRequests
      .filter((request) => request.receiver_id === req.user!.id && request.status === 'pending')
      .map((request) => ({ ...request, student: studentCard(request.sender_id) }));
    const outgoing = memoryFriendRequests
      .filter((request) => request.sender_id === req.user!.id && request.status === 'pending')
      .map((request) => ({ ...request, student: studentCard(request.receiver_id) }));
    return res.json({ incoming, outgoing });
  }
  const incoming = await query(
    `SELECT fr.*, coalesce(sp.full_name, u.name) AS name, coalesce(sp.profile_picture_url, u.avatar_url) AS "profilePictureUrl", u.status, u.last_active_at
     FROM friend_requests fr JOIN users u ON u.id=fr.sender_id LEFT JOIN student_profiles sp ON sp.user_id=u.id
     WHERE fr.receiver_id=$1 AND fr.status='pending' ORDER BY fr.created_at DESC`,
    [req.user!.id]
  );
  const outgoing = await query(
    `SELECT fr.*, coalesce(sp.full_name, u.name) AS name, coalesce(sp.profile_picture_url, u.avatar_url) AS "profilePictureUrl", u.status, u.last_active_at
     FROM friend_requests fr JOIN users u ON u.id=fr.receiver_id LEFT JOIN student_profiles sp ON sp.user_id=u.id
     WHERE fr.sender_id=$1 AND fr.status='pending' ORDER BY fr.created_at DESC`,
    [req.user!.id]
  );
  const mapRow = (row: any) => ({ ...row, student: { id: row.sender_id === req.user!.id ? row.receiver_id : row.sender_id, name: row.name, profilePictureUrl: row.profilePictureUrl, status: currentStatus({ status: row.status, last_active_at: row.last_active_at }) } });
  res.json({ incoming: incoming.rows.map(mapRow), outgoing: outgoing.rows.map(mapRow) });
}));

app.post('/api/friend-requests', requireAuth, asyncRoute(async (req, res) => {
  const body = z.object({ receiverId: z.string().uuid() }).parse(req.body);
  if (body.receiverId === req.user!.id) throw new Error('You cannot send a friend request to yourself.');
  if (await preferMemory()) {
    if (!memoryUsers.some((user) => user.id === body.receiverId && user.role === 'student')) return res.status(404).json({ message: 'Student not found' });
    if (areMemoryFriends(req.user!.id, body.receiverId)) throw new Error('You are already friends.');
    const existing = memoryFriendRequests.find(
      (request) =>
        request.status === 'pending' &&
        ((request.sender_id === req.user!.id && request.receiver_id === body.receiverId) || (request.sender_id === body.receiverId && request.receiver_id === req.user!.id))
    );
    if (existing) return res.status(409).json({ message: 'A friend request already exists.' });
    const request = { id: randomUUID(), sender_id: req.user!.id, receiver_id: body.receiverId, status: 'pending' as const, created_at: new Date(), responded_at: null };
    memoryFriendRequests.push(request);
    return res.status(201).json(request);
  }
  const existing = await query(
    `SELECT 1 FROM friends WHERE user_id=$1 AND friend_id=$2
     UNION
     SELECT 1 FROM friend_requests WHERE status='pending' AND ((sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1))`,
    [req.user!.id, body.receiverId]
  );
  if (existing.rows[0]) return res.status(409).json({ message: 'Request or friendship already exists.' });
  const result = await query('INSERT INTO friend_requests (sender_id, receiver_id) VALUES ($1,$2) RETURNING *', [req.user!.id, body.receiverId]);
  res.status(201).json(result.rows[0]);
}));

app.post('/api/friend-requests/:id/respond', requireAuth, asyncRoute(async (req, res) => {
  const body = z.object({ action: z.enum(['accept', 'reject']) }).parse(req.body);
  const requestId = routeParam(req.params.id);
  if (await preferMemory()) {
    const request = memoryFriendRequests.find((item) => item.id === requestId && item.receiver_id === req.user!.id && item.status === 'pending');
    if (!request) return res.status(404).json({ message: 'Friend request not found' });
    request.status = body.action === 'accept' ? 'accepted' : 'rejected';
    request.responded_at = new Date();
    if (body.action === 'accept') {
      memoryFriends.push({ user_id: request.sender_id, friend_id: request.receiver_id, created_at: new Date() }, { user_id: request.receiver_id, friend_id: request.sender_id, created_at: new Date() });
      findOrCreateMemoryChat(request.sender_id, request.receiver_id);
    }
    return res.json(request);
  }
  const requestResult = await query('SELECT * FROM friend_requests WHERE id=$1 AND receiver_id=$2 AND status=$3', [requestId, req.user!.id, 'pending']);
  const request = requestResult.rows[0];
  if (!request) return res.status(404).json({ message: 'Friend request not found' });
  await query('UPDATE friend_requests SET status=$1, responded_at=now() WHERE id=$2', [body.action === 'accept' ? 'accepted' : 'rejected', request.id]);
  if (body.action === 'accept') {
    await query('INSERT INTO friends (user_id, friend_id) VALUES ($1,$2),($2,$1) ON CONFLICT DO NOTHING', [request.sender_id, request.receiver_id]);
    await query(
      `INSERT INTO private_chats (user_one_id, user_two_id)
       VALUES (LEAST($1::uuid,$2::uuid), GREATEST($1::uuid,$2::uuid))
       ON CONFLICT (user_one_id, user_two_id) DO NOTHING`,
      [request.sender_id, request.receiver_id]
    );
  }
  res.json({ ok: true });
}));

app.get('/api/friends', requireAuth, asyncRoute(async (req, res) => {
  if (await preferMemory()) {
    return res.json(memoryFriends.filter((friend) => friend.user_id === req.user!.id).map((friend) => studentCard(friend.friend_id)).filter(Boolean));
  }
  const result = await query(
    `SELECT u.id, coalesce(sp.full_name, u.name) AS name, coalesce(sp.profile_picture_url, u.avatar_url) AS "profilePictureUrl", u.status, u.last_active_at
     FROM friends f JOIN users u ON u.id=f.friend_id LEFT JOIN student_profiles sp ON sp.user_id=u.id
     WHERE f.user_id=$1 ORDER BY name`,
    [req.user!.id]
  );
  res.json(result.rows.map((row) => ({ ...row, status: currentStatus({ status: row.status, last_active_at: row.last_active_at }) })));
}));

app.delete('/api/friends/:friendId', requireAuth, asyncRoute(async (req, res) => {
  const friendId = routeParam(req.params.friendId);
  if (await preferMemory()) {
    for (let index = memoryFriends.length - 1; index >= 0; index -= 1) {
      const item = memoryFriends[index];
      if ((item.user_id === req.user!.id && item.friend_id === friendId) || (item.user_id === friendId && item.friend_id === req.user!.id)) memoryFriends.splice(index, 1);
    }
    return res.status(204).end();
  }
  await query('DELETE FROM friends WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)', [req.user!.id, friendId]);
  res.status(204).end();
}));

app.get('/api/chats', requireAuth, asyncRoute(async (req, res) => {
  if (await preferMemory()) {
    const chats = memoryPrivateChats
      .filter((chat) => chat.user_one_id === req.user!.id || chat.user_two_id === req.user!.id)
      .map((chat) => {
        const friendId = chat.user_one_id === req.user!.id ? chat.user_two_id : chat.user_one_id;
        const latest = [...memoryPrivateMessages].filter((message) => message.chat_id === chat.id).sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0];
        const unread = memoryPrivateMessages.filter((message) => message.chat_id === chat.id && message.sender_id !== req.user!.id && !message.read_at).length;
        return { id: chat.id, friend: studentCard(friendId), latestMessage: latest || null, unread };
      });
    return res.json(chats);
  }
  const result = await query(
    `SELECT pc.id,
            CASE WHEN pc.user_one_id=$1 THEN pc.user_two_id ELSE pc.user_one_id END AS "friendId",
            coalesce(sp.full_name, u.name) AS name,
            coalesce(sp.profile_picture_url, u.avatar_url) AS "profilePictureUrl",
            u.status,
            u.last_active_at,
            (SELECT message_text FROM private_messages pm WHERE pm.chat_id=pc.id ORDER BY pm.created_at DESC LIMIT 1) AS "latestMessageText",
            (SELECT count(*)::int FROM private_messages pm WHERE pm.chat_id=pc.id AND pm.sender_id<>$1 AND pm.read_at IS NULL) AS unread
     FROM private_chats pc
     JOIN users u ON u.id=CASE WHEN pc.user_one_id=$1 THEN pc.user_two_id ELSE pc.user_one_id END
     LEFT JOIN student_profiles sp ON sp.user_id=u.id
     WHERE pc.user_one_id=$1 OR pc.user_two_id=$1`,
    [req.user!.id]
  );
  res.json(result.rows.map((row) => ({ id: row.id, friend: { id: row.friendId, name: row.name, profilePictureUrl: row.profilePictureUrl, status: currentStatus({ status: row.status, last_active_at: row.last_active_at }) }, latestMessage: row.latestMessageText ? { message_text: row.latestMessageText } : null, unread: row.unread })));
}));

app.get('/api/chats/:friendId/messages', requireAuth, asyncRoute(async (req, res) => {
  const friendId = routeParam(req.params.friendId);
  if (await preferMemory()) {
    ensureMemoryFriend(req.user!.id, friendId);
    const chat = findOrCreateMemoryChat(req.user!.id, friendId);
    for (const message of memoryPrivateMessages) if (message.chat_id === chat.id && message.sender_id !== req.user!.id && !message.read_at) message.read_at = new Date();
    return res.json(memoryPrivateMessages.filter((message) => message.chat_id === chat.id).map((message) => ({ ...message, sender: studentCard(message.sender_id) })));
  }
  const friendship = await query('SELECT 1 FROM friends WHERE user_id=$1 AND friend_id=$2', [req.user!.id, friendId]);
  if (!friendship.rows[0]) return res.status(403).json({ message: 'Only friends can chat with each other.' });
  const chat = await query(
    `INSERT INTO private_chats (user_one_id, user_two_id)
     VALUES (LEAST($1::uuid,$2::uuid), GREATEST($1::uuid,$2::uuid))
     ON CONFLICT (user_one_id, user_two_id) DO UPDATE SET user_one_id=private_chats.user_one_id
     RETURNING id`,
    [req.user!.id, friendId]
  );
  await query('UPDATE private_messages SET read_at=now() WHERE chat_id=$1 AND sender_id<>$2 AND read_at IS NULL', [chat.rows[0].id, req.user!.id]);
  const rows = await query(
    `SELECT pm.*, coalesce(sp.full_name, u.name) AS name, coalesce(sp.profile_picture_url, u.avatar_url) AS "profilePictureUrl"
     FROM private_messages pm JOIN users u ON u.id=pm.sender_id LEFT JOIN student_profiles sp ON sp.user_id=u.id
     WHERE pm.chat_id=$1 ORDER BY pm.created_at`,
    [chat.rows[0].id]
  );
  res.json(rows.rows.map((row) => ({ ...row, sender: { id: row.sender_id, name: row.name, profilePictureUrl: row.profilePictureUrl } })));
}));

app.post('/api/chats/:friendId/messages', requireAuth, asyncRoute(async (req, res) => {
  const body = z.object({ message: z.string().trim().min(1).max(1000) }).parse(req.body);
  const friendId = routeParam(req.params.friendId);
  if (await preferMemory()) {
    ensureMemoryFriend(req.user!.id, friendId);
    const chat = findOrCreateMemoryChat(req.user!.id, friendId);
    const message = { id: randomUUID(), chat_id: chat.id, sender_id: req.user!.id, message_text: body.message, read_at: null, created_at: new Date() };
    memoryPrivateMessages.push(message);
    return res.status(201).json({ ...message, sender: studentCard(req.user!.id) });
  }
  const friendship = await query('SELECT 1 FROM friends WHERE user_id=$1 AND friend_id=$2', [req.user!.id, friendId]);
  if (!friendship.rows[0]) return res.status(403).json({ message: 'Only friends can chat with each other.' });
  const chat = await query(
    `INSERT INTO private_chats (user_one_id, user_two_id)
     VALUES (LEAST($1::uuid,$2::uuid), GREATEST($1::uuid,$2::uuid))
     ON CONFLICT (user_one_id, user_two_id) DO UPDATE SET user_one_id=private_chats.user_one_id
     RETURNING id`,
    [req.user!.id, friendId]
  );
  const result = await query('INSERT INTO private_messages (chat_id, sender_id, message_text) VALUES ($1,$2,$3) RETURNING *', [chat.rows[0].id, req.user!.id, body.message]);
  res.status(201).json(result.rows[0]);
}));

app.get('/api/groups', requireAuth, asyncRoute(async (req, res) => {
  if (await preferMemory()) {
    return res.json(memoryGroupMembers.filter((member) => member.user_id === req.user!.id).map((member) => groupView(member.group_id)).filter(Boolean));
  }
  const result = await query(
    `SELECT g.*,
            gm.is_admin AS "isCurrentUserAdmin",
            (SELECT count(*)::int FROM group_members WHERE group_id=g.id) AS "memberCount",
            (SELECT message_text FROM group_messages WHERE group_id=g.id ORDER BY created_at DESC LIMIT 1) AS "latestMessageText"
     FROM groups g JOIN group_members gm ON gm.group_id=g.id
     WHERE gm.user_id=$1 ORDER BY g.updated_at DESC`,
    [req.user!.id]
  );
  res.json(result.rows);
}));

app.post('/api/groups', requireAuth, asyncRoute(async (req, res) => {
  const body = z.object({ name: z.string().trim().min(2).max(80), picture: z.object({ name: z.string(), type: z.string(), dataUrl: z.string() }).optional() }).parse(req.body);
  const pictureUrl = await saveProfilePicture(`group-${req.user!.id}`, body.picture);
  if (await preferMemory()) {
    const group = { id: randomUUID(), name: body.name, picture_url: pictureUrl || null, created_by: req.user!.id, created_at: new Date(), updated_at: new Date() };
    memoryGroups.push(group);
    memoryGroupMembers.push({ group_id: group.id, user_id: req.user!.id, is_admin: true, joined_at: new Date() });
    return res.status(201).json(groupView(group.id));
  }
  const group = await query('INSERT INTO groups (name, picture_url, created_by) VALUES ($1,$2,$3) RETURNING *', [body.name, pictureUrl || null, req.user!.id]);
  await query('INSERT INTO group_members (group_id, user_id, is_admin) VALUES ($1,$2,true)', [group.rows[0].id, req.user!.id]);
  res.status(201).json(group.rows[0]);
}));

app.get('/api/groups/:id', requireAuth, asyncRoute(async (req, res) => {
  const groupId = routeParam(req.params.id);
  if (await preferMemory()) {
    ensureMemoryGroupMember(groupId, req.user!.id);
    return res.json(groupView(groupId));
  }
  const member = await query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2', [groupId, req.user!.id]);
  if (!member.rows[0]) return res.status(403).json({ message: 'You can access only groups where you are a member.' });
  const group = await query('SELECT * FROM groups WHERE id=$1', [groupId]);
  const members = await query(
    `SELECT gm.is_admin AS "isAdmin", coalesce(sp.full_name, u.name) AS name, coalesce(sp.profile_picture_url, u.avatar_url) AS "profilePictureUrl", u.id, u.status, u.last_active_at
     FROM group_members gm JOIN users u ON u.id=gm.user_id LEFT JOIN student_profiles sp ON sp.user_id=u.id
     WHERE gm.group_id=$1 ORDER BY gm.is_admin DESC, name`,
    [groupId]
  );
  res.json({ ...group.rows[0], members: members.rows.map((row) => ({ ...row, status: currentStatus({ status: row.status, last_active_at: row.last_active_at }) })) });
}));

app.put('/api/groups/:id', requireAuth, asyncRoute(async (req, res) => {
  const body = z.object({ name: z.string().trim().min(2).max(80), picture: z.object({ name: z.string(), type: z.string(), dataUrl: z.string() }).optional() }).parse(req.body);
  const pictureUrl = await saveProfilePicture(`group-${req.user!.id}`, body.picture);
  const groupId = routeParam(req.params.id);
  if (await preferMemory()) {
    ensureMemoryGroupAdmin(groupId, req.user!.id);
    const group = memoryGroups.find((item) => item.id === groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    group.name = body.name;
    if (pictureUrl) group.picture_url = pictureUrl;
    group.updated_at = new Date();
    return res.json(groupView(group.id));
  }
  const admin = await query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2 AND is_admin=true', [groupId, req.user!.id]);
  if (!admin.rows[0]) return res.status(403).json({ message: 'Only group admins can perform this action.' });
  const result = await query('UPDATE groups SET name=$1, picture_url=coalesce($2,picture_url), updated_at=now() WHERE id=$3 RETURNING *', [body.name, pictureUrl || null, groupId]);
  res.json(result.rows[0]);
}));

app.post('/api/groups/:id/members', requireAuth, asyncRoute(async (req, res) => {
  const body = z.object({ userId: z.string().uuid() }).parse(req.body);
  const groupId = routeParam(req.params.id);
  if (await preferMemory()) {
    ensureMemoryGroupAdmin(groupId, req.user!.id);
    ensureMemoryFriend(req.user!.id, body.userId);
    if (!memoryGroupMember(groupId, body.userId)) memoryGroupMembers.push({ group_id: groupId, user_id: body.userId, is_admin: false, joined_at: new Date() });
    return res.status(201).json(groupView(groupId));
  }
  const admin = await query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2 AND is_admin=true', [groupId, req.user!.id]);
  if (!admin.rows[0]) return res.status(403).json({ message: 'Only group admins can perform this action.' });
  const friendship = await query('SELECT 1 FROM friends WHERE user_id=$1 AND friend_id=$2', [req.user!.id, body.userId]);
  if (!friendship.rows[0]) return res.status(403).json({ message: 'You can invite only your friends.' });
  await query('INSERT INTO group_members (group_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [groupId, body.userId]);
  res.status(201).json({ ok: true });
}));

app.delete('/api/groups/:id/members/:userId', requireAuth, asyncRoute(async (req, res) => {
  const groupId = routeParam(req.params.id);
  const userId = routeParam(req.params.userId);
  if (await preferMemory()) {
    ensureMemoryGroupAdmin(groupId, req.user!.id);
    const group = memoryGroups.find((item) => item.id === groupId);
    if (group?.created_by === userId) throw new Error('The group creator cannot be removed by another admin.');
    const index = memoryGroupMembers.findIndex((member) => member.group_id === groupId && member.user_id === userId);
    if (index >= 0) memoryGroupMembers.splice(index, 1);
    return res.status(204).end();
  }
  const admin = await query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2 AND is_admin=true', [groupId, req.user!.id]);
  if (!admin.rows[0]) return res.status(403).json({ message: 'Only group admins can perform this action.' });
  await query('DELETE FROM group_members gm USING groups g WHERE gm.group_id=g.id AND gm.group_id=$1 AND gm.user_id=$2 AND g.created_by<>$2', [groupId, userId]);
  res.status(204).end();
}));

app.patch('/api/groups/:id/members/:userId', requireAuth, asyncRoute(async (req, res) => {
  const body = z.object({ isAdmin: z.boolean() }).parse(req.body);
  const groupId = routeParam(req.params.id);
  const userId = routeParam(req.params.userId);
  if (await preferMemory()) {
    ensureMemoryGroupAdmin(groupId, req.user!.id);
    const group = memoryGroups.find((item) => item.id === groupId);
    if (group?.created_by === userId && !body.isAdmin) throw new Error('The group creator must remain an admin unless they leave.');
    const member = memoryGroupMember(groupId, userId);
    if (!member) return res.status(404).json({ message: 'Group member not found' });
    member.is_admin = body.isAdmin;
    return res.json(groupView(groupId));
  }
  const admin = await query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2 AND is_admin=true', [groupId, req.user!.id]);
  if (!admin.rows[0]) return res.status(403).json({ message: 'Only group admins can perform this action.' });
  await query('UPDATE group_members SET is_admin=$1 WHERE group_id=$2 AND user_id=$3 AND NOT ($1=false AND user_id=(SELECT created_by FROM groups WHERE id=$2))', [body.isAdmin, groupId, userId]);
  res.json({ ok: true });
}));

app.post('/api/groups/:id/leave', requireAuth, asyncRoute(async (req, res) => {
  const groupId = routeParam(req.params.id);
  if (await preferMemory()) {
    const group = memoryGroups.find((item) => item.id === groupId);
    const admins = memoryGroupMembers.filter((member) => member.group_id === groupId && member.is_admin);
    if (group?.created_by === req.user!.id && admins.length <= 1 && memoryGroupMembers.filter((member) => member.group_id === groupId).length > 1) {
      throw new Error('Assign another admin before the creator leaves.');
    }
    const index = memoryGroupMembers.findIndex((member) => member.group_id === groupId && member.user_id === req.user!.id);
    if (index >= 0) memoryGroupMembers.splice(index, 1);
    return res.status(204).end();
  }
  const group = await query('SELECT created_by FROM groups WHERE id=$1', [groupId]);
  const admins = await query('SELECT count(*)::int count FROM group_members WHERE group_id=$1 AND is_admin=true', [groupId]);
  const members = await query('SELECT count(*)::int count FROM group_members WHERE group_id=$1', [groupId]);
  if (group.rows[0]?.created_by === req.user!.id && admins.rows[0].count <= 1 && members.rows[0].count > 1) throw new Error('Assign another admin before the creator leaves.');
  await query('DELETE FROM group_members WHERE group_id=$1 AND user_id=$2', [groupId, req.user!.id]);
  res.status(204).end();
}));

app.get('/api/groups/:id/messages', requireAuth, asyncRoute(async (req, res) => {
  const groupId = routeParam(req.params.id);
  if (await preferMemory()) {
    ensureMemoryGroupMember(groupId, req.user!.id);
    return res.json(memoryGroupMessages.filter((message) => message.group_id === groupId).map((message) => ({ ...message, sender: studentCard(message.sender_id) })));
  }
  const member = await query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2', [groupId, req.user!.id]);
  if (!member.rows[0]) return res.status(403).json({ message: 'You can access only groups where you are a member.' });
  const rows = await query(
    `SELECT gm.*, coalesce(sp.full_name, u.name) AS name, coalesce(sp.profile_picture_url, u.avatar_url) AS "profilePictureUrl"
     FROM group_messages gm JOIN users u ON u.id=gm.sender_id LEFT JOIN student_profiles sp ON sp.user_id=u.id
     WHERE gm.group_id=$1 ORDER BY gm.created_at`,
    [groupId]
  );
  res.json(rows.rows.map((row) => ({ ...row, sender: { id: row.sender_id, name: row.name, profilePictureUrl: row.profilePictureUrl } })));
}));

app.post('/api/groups/:id/messages', requireAuth, asyncRoute(async (req, res) => {
  const body = z.object({ message: z.string().trim().min(1).max(1000) }).parse(req.body);
  const groupId = routeParam(req.params.id);
  if (await preferMemory()) {
    ensureMemoryGroupMember(groupId, req.user!.id);
    const message = { id: randomUUID(), group_id: groupId, sender_id: req.user!.id, message_text: body.message, created_at: new Date() };
    memoryGroupMessages.push(message);
    const group = memoryGroups.find((item) => item.id === groupId);
    if (group) group.updated_at = new Date();
    return res.status(201).json({ ...message, sender: studentCard(req.user!.id) });
  }
  const member = await query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2', [groupId, req.user!.id]);
  if (!member.rows[0]) return res.status(403).json({ message: 'You can access only groups where you are a member.' });
  const result = await query('INSERT INTO group_messages (group_id, sender_id, message_text) VALUES ($1,$2,$3) RETURNING *', [groupId, req.user!.id, body.message]);
  await query('UPDATE groups SET updated_at=now() WHERE id=$1', [groupId]);
  res.status(201).json(result.rows[0]);
}));

app.get('/api/questions', requireAuth, asyncRoute(async (req, res) => {
  const { search = '', topic = '', difficulty = '', category = '' } = req.query;
  if (await preferMemory()) {
    const text = String(search).toLowerCase();
    const rows = memoryQuestions
      .filter((question) => !text || question.title.toLowerCase().includes(text) || question.statement.toLowerCase().includes(text))
      .filter((question) => !topic || question.topic === topic)
      .filter((question) => !difficulty || question.difficulty === difficulty)
      .filter((question) => !category || question.category === category)
      .slice(0, 100)
      .map(({ cases: _cases, ...question }) => question);
    return res.json(rows);
  }
  const result = await query(
    `SELECT id,title,slug,category,topic,difficulty,points
     FROM questions
     WHERE ($1='' OR title ILIKE '%' || $1 || '%' OR statement ILIKE '%' || $1 || '%')
       AND ($2='' OR topic=$2)
       AND ($3='' OR difficulty=$3)
       AND ($4='' OR category=$4)
     ORDER BY created_at DESC LIMIT 100`,
    [search, topic, difficulty, category]
  );
  res.json(result.rows);
}));

app.get('/api/questions/random', requireAuth, asyncRoute(async (_req, res) => {
  if (await preferMemory()) {
    const question = memoryQuestions[Math.floor(Math.random() * memoryQuestions.length)];
    const { cases: _cases, ...row } = question;
    return res.json(row);
  }
  const result = await query('SELECT id,title,slug,category,topic,difficulty,points FROM questions ORDER BY random() LIMIT 1');
  res.json(result.rows[0]);
}));

app.get('/api/questions/:id', requireAuth, asyncRoute(async (req, res) => {
  if (await preferMemory()) {
    const question = memoryQuestions.find((item) => item.id === req.params.id);
    if (!question) return res.status(404).json({ message: 'Question not found' });
    const { cases, ...row } = question;
    return res.json({ ...row, public_cases: cases.filter((testCase) => !testCase.is_hidden) });
  }
  const question = await query('SELECT * FROM questions WHERE id=$1', [req.params.id]);
  if (!question.rows[0]) return res.status(404).json({ message: 'Question not found' });
  const cases = await query('SELECT id,input_data,expected_output,is_hidden FROM test_cases WHERE question_id=$1 AND is_hidden=false', [req.params.id]);
  res.json({ ...question.rows[0], public_cases: cases.rows });
}));

app.post('/api/run', requireAuth, asyncRoute(async (req, res) => {
  const body = z.object({ sourceCode: z.string().min(1), input: z.string().optional() }).parse(req.body);
  const result = await executePython(body.sourceCode, body.input || '');
  res.json(result);
}));

app.post('/api/submit', requireAuth, asyncRoute(async (req, res) => {
  const body = z.object({ questionId: z.string().uuid(), sourceCode: z.string().min(1) }).parse(req.body);
  const useMemory = await preferMemory();
  const cases = useMemory
    ? { rows: memoryQuestions.find((item) => item.id === body.questionId)?.cases || [] }
    : await query('SELECT input_data, expected_output, is_hidden, weight FROM test_cases WHERE question_id=$1', [body.questionId]);
  let passedWeight = 0;
  let totalWeight = 0;
  const results = [];
  const started = Date.now();
  for (const testCase of cases.rows) {
    totalWeight += testCase.weight;
    const output = await executePython(body.sourceCode, testCase.input_data);
    const passed = !output.stderr && normalizeOutput(output.stdout) === normalizeOutput(testCase.expected_output);
    if (passed) passedWeight += testCase.weight;
    results.push({
      hidden: testCase.is_hidden,
      passed,
      input: testCase.is_hidden ? undefined : testCase.input_data,
      expected: testCase.is_hidden ? undefined : testCase.expected_output,
      actual: testCase.is_hidden ? undefined : output.stdout,
      error: output.stderr
    });
  }
  const score = totalWeight ? Math.round((passedWeight / totalWeight) * 100) : 0;
  const status = score === 100 ? 'accepted' : score > 0 ? 'partial' : 'failed';
  if (useMemory) {
    memorySubmissions.push({ user_id: req.user!.id, question_id: body.questionId, score, created_at: new Date() });
  } else {
    await query(
      'INSERT INTO submissions (user_id, question_id, source_code, status, score, runtime_ms) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user!.id, body.questionId, body.sourceCode, status, score, Date.now() - started]
    );
  }
  res.json({ status, score, results });
}));

app.get('/api/analytics', requireAuth, asyncRoute(async (req, res) => {
  if (await preferMemory()) {
    const own = memorySubmissions.filter((submission) => submission.user_id === req.user!.id);
    const solved = new Set(own.map((submission) => submission.question_id)).size;
    const accuracy = own.length ? Math.round(own.reduce((sum, item) => sum + item.score, 0) / own.length) : 0;
    const topicMap = new Map<string, { total: number; count: number }>();
    for (const submission of own) {
      const question = memoryQuestions.find((item) => item.id === submission.question_id);
      if (!question) continue;
      const current = topicMap.get(question.topic) || { total: 0, count: 0 };
      topicMap.set(question.topic, { total: current.total + submission.score, count: current.count + 1 });
    }
    const topics = Array.from(topicMap.entries()).map(([topic, item]) => ({ topic, accuracy: Math.round(item.total / item.count), attempts: item.count }));
    const labels = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
    return res.json({
      overview: { attempts: own.length, solved, accuracy },
      topics,
      weekly: labels.map((label, index) => ({ label, attempts: index === labels.length - 1 ? own.length : 0 }))
    });
  }
  const overview = await query(
    `SELECT count(*)::int attempts, count(DISTINCT question_id)::int solved, coalesce(round(avg(score),2),0) accuracy
     FROM submissions WHERE user_id=$1`,
    [req.user!.id]
  );
  const topic = await query(
    `SELECT q.topic, round(avg(s.score),2) accuracy, count(*)::int attempts
     FROM submissions s JOIN questions q ON q.id=s.question_id
     WHERE s.user_id=$1 GROUP BY q.topic ORDER BY accuracy DESC`,
    [req.user!.id]
  );
  const weekly = await query(
    `SELECT to_char(day, 'Dy') label, coalesce(count(s.id),0)::int attempts
     FROM generate_series(current_date - interval '6 days', current_date, interval '1 day') day
     LEFT JOIN submissions s ON date(s.created_at)=day AND s.user_id=$1
     GROUP BY day ORDER BY day`,
    [req.user!.id]
  );
  res.json({ overview: overview.rows[0], topics: topic.rows, weekly: weekly.rows });
}));

app.get('/api/leaderboard', requireAuth, asyncRoute(async (req, res) => {
  const scope = String(req.query.scope || 'global');
  if (await preferMemory()) {
    const rows = memoryUsers
      .filter((user) => scope === 'global' || user.college === req.user!.college)
      .map((user) => {
        const own = memorySubmissions.filter((submission) => submission.user_id === user.id);
        const solved = new Set(own.map((submission) => submission.question_id)).size;
        const accuracy = own.length ? Math.round(own.reduce((sum, item) => sum + item.score, 0) / own.length) : 0;
        const points = own.reduce((sum, submission) => {
          const question = memoryQuestions.find((item) => item.id === submission.question_id);
          return sum + Math.round(((question?.points || 0) * submission.score) / 100);
        }, 0);
        return { name: user.name, college: user.college, solved, accuracy, points };
      })
      .filter((row) => row.solved > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 50);
    return res.json(rows);
  }
  const rows = await query(
    `SELECT u.name,u.college,count(DISTINCT s.question_id)::int solved, round(avg(s.score),2) accuracy, sum(q.points * s.score / 100)::int points
     FROM users u
     JOIN submissions s ON s.user_id=u.id
     JOIN questions q ON q.id=s.question_id
     WHERE ($1='global' OR u.college=$2)
     GROUP BY u.id ORDER BY points DESC NULLS LAST LIMIT 50`,
    [scope, req.user!.college]
  );
  res.json(rows.rows);
}));

app.get('/api/mock-tests', requireAuth, asyncRoute(async (_req, res) => {
  if (await preferMemory()) return res.json(memoryMockTests);
  const result = await query('SELECT * FROM mock_tests ORDER BY duration_minutes');
  res.json(result.rows);
}));

app.post('/api/mock-tests/:id/start', requireAuth, asyncRoute(async (req, res) => {
  const useMemory = await preferMemory();
  if (useMemory) {
    const test = memoryMockTests.find((item) => item.id === req.params.id);
    if (!test) return res.status(404).json({ message: 'Mock test not found' });
    const questionCount = test.duration_minutes <= 30 ? 3 : test.duration_minutes <= 60 ? 5 : test.duration_minutes <= 90 ? 8 : 12;
    const questions = [...memoryQuestions]
      .sort(() => Math.random() - 0.5)
      .slice(0, questionCount)
      .map(({ cases: _cases, ...question }) => question);
    const startedAt = new Date();
    const attempt = {
      id: randomUUID(),
      user_id: req.user!.id,
      mock_test_id: test.id,
      question_ids: questions.map((question) => question.id),
      started_at: startedAt,
      ends_at: new Date(startedAt.getTime() + test.duration_minutes * 60 * 1000),
      status: 'in_progress' as const
    };
    memoryMockAttempts.set(attempt.id, attempt);
    return res.status(201).json({ attemptId: attempt.id, test, questions, startedAt: attempt.started_at, endsAt: attempt.ends_at });
  }

  const testResult = await query('SELECT * FROM mock_tests WHERE id=$1', [req.params.id]);
  const test = testResult.rows[0];
  if (!test) return res.status(404).json({ message: 'Mock test not found' });
  const questionCount = test.duration_minutes <= 30 ? 3 : test.duration_minutes <= 60 ? 5 : test.duration_minutes <= 90 ? 8 : 12;
  const questions = await query(
    'SELECT id,title,slug,category,topic,difficulty,points FROM questions ORDER BY random() LIMIT $1',
    [questionCount]
  );
  const attemptResult = await query<{ id: string; started_at: Date }>(
    'INSERT INTO mock_attempts (user_id, mock_test_id) VALUES ($1,$2) RETURNING id, started_at',
    [req.user!.id, test.id]
  );
  const attemptId = attemptResult.rows[0].id;
  for (const [index, question] of questions.rows.entries()) {
    await query('INSERT INTO mock_attempt_questions (attempt_id, question_id, sort_order) VALUES ($1,$2,$3)', [attemptId, question.id, index + 1]);
  }
  const startedAt = attemptResult.rows[0].started_at;
  const endsAt = new Date(new Date(startedAt).getTime() + test.duration_minutes * 60 * 1000);
  res.status(201).json({ attemptId, test, questions: questions.rows, startedAt, endsAt });
}));

app.post('/api/mock-attempts/:id/submit', requireAuth, asyncRoute(async (req, res) => {
  const body = z.object({ autoSubmitted: z.boolean().optional() }).parse(req.body);
  const attemptId = String(req.params.id);
  const useMemory = await preferMemory();
  if (useMemory) {
    const attempt = memoryMockAttempts.get(attemptId);
    if (!attempt || attempt.user_id !== req.user!.id) return res.status(404).json({ message: 'Mock attempt not found' });
    attempt.status = body.autoSubmitted ? 'auto_submitted' : 'submitted';
    const latestByQuestion = attempt.question_ids.map((questionId) => {
      const submissions = memorySubmissions
        .filter((submission) => submission.user_id === req.user!.id && submission.question_id === questionId && submission.created_at >= attempt.started_at)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      const question = memoryQuestions.find((item) => item.id === questionId);
      return { questionId, title: question?.title || 'Question', score: submissions[0]?.score || 0, attempted: submissions.length > 0 };
    });
    const totalScore = latestByQuestion.reduce((sum, item) => sum + item.score, 0);
    const score = latestByQuestion.length ? Math.round(totalScore / latestByQuestion.length) : 0;
    return res.json({
      status: attempt.status,
      score,
      attempted: latestByQuestion.filter((item) => item.attempted).length,
      totalQuestions: latestByQuestion.length,
      results: latestByQuestion
    });
  }

  const attemptResult = await query('SELECT * FROM mock_attempts WHERE id=$1 AND user_id=$2', [attemptId, req.user!.id]);
  const attempt = attemptResult.rows[0];
  if (!attempt) return res.status(404).json({ message: 'Mock attempt not found' });
  const results = await query(
    `SELECT q.id AS "questionId", q.title, coalesce(max(s.score),0)::int AS score, count(s.id)::int > 0 AS attempted
     FROM mock_attempt_questions maq
     JOIN questions q ON q.id=maq.question_id
     LEFT JOIN submissions s ON s.question_id=q.id AND s.user_id=$1 AND s.created_at >= $2
     WHERE maq.attempt_id=$3
     GROUP BY q.id, q.title, maq.sort_order
     ORDER BY maq.sort_order`,
    [req.user!.id, attempt.started_at, attempt.id]
  );
  const totalScore = results.rows.reduce((sum: number, item: any) => sum + Number(item.score), 0);
  const score = results.rows.length ? Math.round(totalScore / results.rows.length) : 0;
  await query('UPDATE mock_attempts SET submitted_at=now(), status=$1, score=$2 WHERE id=$3', [body.autoSubmitted ? 'auto_submitted' : 'submitted', score, attempt.id]);
  res.json({
    status: body.autoSubmitted ? 'auto_submitted' : 'submitted',
    score,
    attempted: results.rows.filter((item: any) => item.attempted).length,
    totalQuestions: results.rows.length,
    results: results.rows
  });
}));

app.get('/api/notifications', requireAuth, asyncRoute(async (req, res) => {
  if (await preferMemory()) {
    seedNotifications();
    const rows = memoryNotifications
      .filter((notification) => notificationApplies(notification, req.user!))
      .map((notification) => memoryNotificationForUser(notification, req.user!.id))
      .filter((notification) => !notification.isCleared)
      .sort((a, b) => new Date(b.publish_at).getTime() - new Date(a.publish_at).getTime());
    return res.json({ notifications: rows, unreadCount: rows.filter((row) => !row.isRead).length });
  }
  await ensureDefaultNotifications();
  const result = await query(
    `SELECT n.*,
            u.name AS "createdByName",
            ns.read_at AS "readAt",
            ns.cleared_at AS "clearedAt",
            ns.read_at IS NOT NULL AS "isRead"
     FROM notifications n
     JOIN users u ON u.id=n.created_by
     LEFT JOIN notification_user_status ns ON ns.notification_id=n.id AND ns.user_id=$1
     WHERE n.status='Published'
       AND n.publish_at<=now()
       AND (n.expires_at IS NULL OR n.expires_at>now())
       AND (n.target='All Users' OR (n.target='Students' AND $2='student') OR (n.target='Admins' AND $2='admin') OR (n.target='Specific User' AND n.specific_user_id=$1))
       AND ns.cleared_at IS NULL
     ORDER BY n.publish_at DESC`,
    [req.user!.id, req.user!.role]
  );
  res.json({ notifications: result.rows, unreadCount: result.rows.filter((row) => !row.isRead).length });
}));

app.post('/api/notifications/:id/read', requireAuth, asyncRoute(async (req, res) => {
  const notificationId = routeParam(req.params.id);
  if (await preferMemory()) {
    const notification = memoryNotifications.find((item) => item.id === notificationId);
    if (!notification || !notificationApplies(notification, req.user!)) return res.status(404).json({ message: 'Notification not found' });
    let state = memoryNotificationReads.find((item) => item.notification_id === notificationId && item.user_id === req.user!.id);
    if (!state) {
      state = { notification_id: notificationId, user_id: req.user!.id };
      memoryNotificationReads.push(state);
    }
    state.read_at = state.read_at || new Date();
    return res.json({ ok: true });
  }
  await query(
    `INSERT INTO notification_user_status (notification_id, user_id, read_at)
     VALUES ($1,$2,now())
     ON CONFLICT (notification_id, user_id) DO UPDATE SET read_at=coalesce(notification_user_status.read_at, now())`,
    [notificationId, req.user!.id]
  );
  res.json({ ok: true });
}));

app.post('/api/notifications/:id/clear', requireAuth, asyncRoute(async (req, res) => {
  const notificationId = routeParam(req.params.id);
  if (await preferMemory()) {
    const notification = memoryNotifications.find((item) => item.id === notificationId);
    if (!notification || !notificationApplies(notification, req.user!)) return res.status(404).json({ message: 'Notification not found' });
    let state = memoryNotificationReads.find((item) => item.notification_id === notificationId && item.user_id === req.user!.id);
    if (!state) {
      state = { notification_id: notificationId, user_id: req.user!.id };
      memoryNotificationReads.push(state);
    }
    state.cleared_at = new Date();
    return res.json({ ok: true });
  }
  await query(
    `INSERT INTO notification_user_status (notification_id, user_id, cleared_at)
     VALUES ($1,$2,now())
     ON CONFLICT (notification_id, user_id) DO UPDATE SET cleared_at=now()`,
    [notificationId, req.user!.id]
  );
  res.json({ ok: true });
}));

app.get('/api/admin/notifications', requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
  if (await preferMemory()) {
    seedNotifications();
    return res.json(
      memoryNotifications
        .map((notification) => ({ ...notification, readCount: notificationReadCount(notification.id), createdByName: memoryUsers.find((user) => user.id === notification.created_by)?.name || 'Admin' }))
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    );
  }
  await ensureDefaultNotifications();
  const result = await query(
    `SELECT n.*, u.name AS "createdByName", count(ns.read_at)::int AS "readCount"
     FROM notifications n
     JOIN users u ON u.id=n.created_by
     LEFT JOIN notification_user_status ns ON ns.notification_id=n.id AND ns.read_at IS NOT NULL
     GROUP BY n.id, u.name
     ORDER BY n.created_at DESC`
  );
  res.json(result.rows);
}));

app.post('/api/admin/notifications', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const body = notificationSchema.parse(req.body);
  if (body.target === 'Specific User' && !body.specificUserId) throw new Error('Select a specific user.');
  const publishAt = new Date(body.publishAt);
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (Number.isNaN(publishAt.getTime())) throw new Error('Publish date/time is invalid.');
  if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= publishAt)) throw new Error('Expiry must be after publish date/time.');
  if (await preferMemory()) {
    const notification: MemoryNotification = {
      id: randomUUID(),
      title: body.title,
      message: body.message,
      type: body.type,
      priority: body.priority,
      target: body.target,
      specific_user_id: body.specificUserId || null,
      publish_at: publishAt,
      expires_at: expiresAt,
      status: body.status,
      created_by: req.user!.id,
      created_at: new Date(),
      updated_at: new Date()
    };
    memoryNotifications.unshift(notification);
    return res.status(201).json(notification);
  }
  const result = await query(
    `INSERT INTO notifications (title,message,type,priority,target,specific_user_id,publish_at,expires_at,status,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [body.title, body.message, body.type, body.priority, body.target, body.specificUserId || null, publishAt, expiresAt, body.status, req.user!.id]
  );
  res.status(201).json(result.rows[0]);
}));

app.put('/api/admin/notifications/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const body = notificationSchema.parse(req.body);
  const notificationId = routeParam(req.params.id);
  if (body.target === 'Specific User' && !body.specificUserId) throw new Error('Select a specific user.');
  const publishAt = new Date(body.publishAt);
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (Number.isNaN(publishAt.getTime())) throw new Error('Publish date/time is invalid.');
  if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= publishAt)) throw new Error('Expiry must be after publish date/time.');
  if (await preferMemory()) {
    const notification = memoryNotifications.find((item) => item.id === notificationId);
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    Object.assign(notification, {
      title: body.title,
      message: body.message,
      type: body.type,
      priority: body.priority,
      target: body.target,
      specific_user_id: body.specificUserId || null,
      publish_at: publishAt,
      expires_at: expiresAt,
      status: body.status,
      updated_at: new Date()
    });
    return res.json(notification);
  }
  const result = await query(
    `UPDATE notifications SET title=$1,message=$2,type=$3,priority=$4,target=$5,specific_user_id=$6,publish_at=$7,expires_at=$8,status=$9,updated_at=now()
     WHERE id=$10 RETURNING *`,
    [body.title, body.message, body.type, body.priority, body.target, body.specificUserId || null, publishAt, expiresAt, body.status, notificationId]
  );
  res.json(result.rows[0]);
}));

app.patch('/api/admin/notifications/:id/publish', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const notificationId = routeParam(req.params.id);
  if (await preferMemory()) {
    const notification = memoryNotifications.find((item) => item.id === notificationId);
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    notification.status = 'Published';
    notification.publish_at = notification.publish_at > new Date() ? notification.publish_at : new Date();
    notification.updated_at = new Date();
    return res.json(notification);
  }
  const result = await query(`UPDATE notifications SET status='Published', publish_at=CASE WHEN publish_at>now() THEN publish_at ELSE now() END, updated_at=now() WHERE id=$1 RETURNING *`, [notificationId]);
  res.json(result.rows[0]);
}));

app.delete('/api/admin/notifications/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const notificationId = routeParam(req.params.id);
  if (await preferMemory()) {
    const index = memoryNotifications.findIndex((item) => item.id === notificationId);
    if (index >= 0) memoryNotifications.splice(index, 1);
    return res.status(204).end();
  }
  await query('DELETE FROM notifications WHERE id=$1', [notificationId]);
  res.status(204).end();
}));

app.get('/api/admin/questions', requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
  if (await preferMemory()) {
    return res.json(memoryQuestions.slice(0, 200).map(({ cases: _cases, ...question }) => question));
  }
  const result = await query('SELECT id,title,category,topic,difficulty,points FROM questions ORDER BY created_at DESC LIMIT 200');
  res.json(result.rows);
}));

app.post('/api/admin/questions', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const body = z.object({
    title: z.string(),
    category: z.enum(['Basic Python', 'Intermediate Python', 'Advanced Python']),
    topic: z.string(),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']),
    statement: z.string(),
    constraintsText: z.string(),
    sampleInput: z.string(),
    sampleOutput: z.string(),
    starterCode: z.string()
  }).parse(req.body);
  const slug = `${body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
  if (await preferMemory()) {
    const question = createMemoryQuestion({
      title: body.title,
      slug,
      category: body.category,
      topic: body.topic,
      difficulty: body.difficulty,
      statement: body.statement,
      constraints: body.constraintsText,
      sampleInput: body.sampleInput,
      sampleOutput: body.sampleOutput,
      starterCode: body.starterCode,
      points: body.difficulty === 'Easy' ? 10 : body.difficulty === 'Medium' ? 20 : 30,
      cases: [{ input: body.sampleInput, output: body.sampleOutput, hidden: false }]
    });
    memoryQuestions.unshift(question);
    const { cases: _cases, ...row } = question;
    return res.status(201).json(row);
  }
  const result = await query(
    `INSERT INTO questions (title,slug,category,topic,difficulty,statement,constraints_text,sample_input,sample_output,starter_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [body.title, slug, body.category, body.topic, body.difficulty, body.statement, body.constraintsText, body.sampleInput, body.sampleOutput, body.starterCode]
  );
  res.status(201).json(result.rows[0]);
}));

app.delete('/api/admin/questions/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  if (await preferMemory()) {
    const index = memoryQuestions.findIndex((question) => question.id === req.params.id);
    if (index >= 0) memoryQuestions.splice(index, 1);
    return res.status(204).end();
  }
  await query('DELETE FROM questions WHERE id=$1', [req.params.id]);
  res.status(204).end();
}));

app.get('/api/admin/export', requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
  if (await preferMemory()) {
    return res.json(
      memoryUsers.map((user) => {
        const own = memorySubmissions.filter((submission) => submission.user_id === user.id);
        const accuracy = own.length ? Math.round(own.reduce((sum, item) => sum + item.score, 0) / own.length) : 0;
        const solved = new Set(own.filter((submission) => submission.score === 100).map((submission) => submission.question_id)).size;
        const attemptedQuestions = new Set(own.map((submission) => submission.question_id)).size;
        const progress = Math.min(100, Math.round((attemptedQuestions / Math.max(memoryQuestions.length, 1)) * 100));
        const lastSubmissionAt = own.length ? own.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0].created_at : null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          college: user.college,
          role: user.role,
          attempts: own.length,
          solved,
          attemptedQuestions,
          totalQuestions: memoryQuestions.length,
          accuracy,
          progress,
          lastSubmissionAt
        };
      })
    );
  }
  const result = await query(
    `SELECT u.id,
            u.name,
            u.email,
            u.college,
            u.role,
            count(s.id)::int attempts,
            count(DISTINCT s.question_id)::int "attemptedQuestions",
            count(DISTINCT CASE WHEN s.score = 100 THEN s.question_id END)::int solved,
            (SELECT count(*)::int FROM questions) AS "totalQuestions",
            coalesce(round(avg(s.score),2),0) accuracy,
            CASE
              WHEN (SELECT count(*) FROM questions) = 0 THEN 0
              ELSE round((count(DISTINCT s.question_id)::numeric / (SELECT count(*) FROM questions)::numeric) * 100)
            END::int progress,
            max(s.created_at) AS "lastSubmissionAt"
     FROM users u LEFT JOIN submissions s ON s.user_id=u.id
     GROUP BY u.id ORDER BY attempts DESC`
  );
  res.json(result.rows);
}));

if (process.env.NODE_ENV === 'production') {
  const clientDist = process.env.CLIENT_DIST_DIR || path.resolve(process.cwd(), '../client/dist');
  app.use(express.static(clientDist));
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(400).json({ message: error instanceof Error ? error.message : 'Request failed' });
});

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}/api`);
});
