CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'password' CHECK (auth_provider IN ('password', 'google')),
  google_sub TEXT UNIQUE,
  avatar_url TEXT,
  college TEXT NOT NULL DEFAULT 'Demo Engineering College',
  role TEXT NOT NULL CHECK (role IN ('student', 'admin')) DEFAULT 'student',
  email_verified BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMPTZ,
  account_status TEXT NOT NULL CHECK (account_status IN ('active', 'suspended', 'banned')) DEFAULT 'active',
  status TEXT NOT NULL CHECK (status IN ('online', 'idle', 'offline')) DEFAULT 'offline',
  streak_count INTEGER NOT NULL DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'password';
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'offline';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE IF NOT EXISTS auth_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('email_verification', 'password_reset')),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  profile_picture_url TEXT,
  basic_info TEXT,
  bio TEXT,
  phone TEXT,
  location TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other', 'Prefer not to say')),
  is_progress_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS is_progress_public BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Basic Python', 'Intermediate Python', 'Advanced Python')),
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  statement TEXT NOT NULL,
  constraints_text TEXT NOT NULL,
  sample_input TEXT NOT NULL,
  sample_output TEXT NOT NULL,
  starter_code TEXT NOT NULL,
  solution_code TEXT,
  points INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  input_data TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  weight INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  source_code TEXT NOT NULL,
  status TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  runtime_ms INTEGER NOT NULL DEFAULT 0,
  output TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mock_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  difficulty_mix JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mock_test_questions (
  mock_test_id UUID NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (mock_test_id, question_id)
);

CREATE TABLE IF NOT EXISTS mock_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mock_test_id UUID NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  score NUMERIC(6,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted', 'auto_submitted')) DEFAULT 'in_progress'
);

ALTER TABLE mock_attempts ADD COLUMN IF NOT EXISTS violation_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mock_attempts ADD COLUMN IF NOT EXISTS cheating_suspected BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE mock_attempts ADD COLUMN IF NOT EXISTS cheating_reason TEXT;
ALTER TABLE mock_attempts ADD COLUMN IF NOT EXISTS device_info JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE mock_attempts ADD COLUMN IF NOT EXISTS webcam_status TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE mock_attempts ADD COLUMN IF NOT EXISTS reviewed_by_admin UUID REFERENCES users(id);
ALTER TABLE mock_attempts ADD COLUMN IF NOT EXISTS admin_remarks TEXT;

CREATE TABLE IF NOT EXISTS mock_attempt_questions (
  attempt_id UUID NOT NULL REFERENCES mock_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS mock_proctoring_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES mock_attempts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL,
  violation_message TEXT NOT NULL,
  device_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  webcam_status TEXT NOT NULL DEFAULT 'not_required',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CHECK (sender_id <> receiver_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_pending_pair
  ON friend_requests (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id))
  WHERE status='pending';

CREATE TABLE IF NOT EXISTS friends (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

CREATE TABLE IF NOT EXISTS private_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_one_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_two_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_one_id, user_two_id),
  CHECK (user_one_id <> user_two_id)
);

CREATE TABLE IF NOT EXISTS private_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES private_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  picture_url TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Feature Update', 'App Change', 'Announcement', 'Maintenance', 'General')),
  priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')) DEFAULT 'Medium',
  target TEXT NOT NULL CHECK (target IN ('All Users', 'Students', 'Admins', 'Specific User')) DEFAULT 'All Users',
  specific_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  publish_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Published')) DEFAULT 'Draft',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_user_status (
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  cleared_at TIMESTAMPTZ,
  PRIMARY KEY (notification_id, user_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Technical Bug', 'App Glitch', 'Question/Test Problem', 'Wrong Test Case or Output', 'Abusive Language', 'Misbehavior', 'Group/Chat Issue', 'Account/Login Issue', 'Suggestion', 'General Feedback')),
  description TEXT NOT NULL,
  related_module TEXT,
  related_question_id TEXT,
  reported_user_identifier TEXT,
  reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')) DEFAULT 'Medium',
  status TEXT NOT NULL CHECK (status IN ('New', 'Under Review', 'Resolved', 'Rejected')) DEFAULT 'New',
  admin_remarks TEXT,
  assigned_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  moderation_action TEXT NOT NULL CHECK (moderation_action IN ('None', 'Warning Placeholder', 'Suspend Placeholder', 'Ban Placeholder')) DEFAULT 'None',
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_submissions_user_created ON submissions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mock_attempt_questions_attempt ON mock_attempt_questions(attempt_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_private_messages_chat ON private_messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_target_status ON notifications(status, target, publish_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_user_status_user ON notification_user_status(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status_priority ON reports(status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_comments_report ON report_comments(report_id, created_at);
