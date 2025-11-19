-- Core typed tables
CREATE TABLE IF NOT EXISTS attendance_event (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  status TEXT NOT NULL,
  ts_utc TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'firebase'
);
CREATE INDEX IF NOT EXISTS idx_att_updated_at ON attendance_event(updated_at DESC);

CREATE TABLE IF NOT EXISTS app_user (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'firebase'
);
CREATE INDEX IF NOT EXISTS idx_user_updated_at ON app_user(updated_at DESC);

CREATE TABLE IF NOT EXISTS course (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  department_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'firebase'
);
CREATE INDEX IF NOT EXISTS idx_course_updated_at ON course(updated_at DESC);

-- Generic "mirrors" for any extra Firestore collections (dynamic shape)
-- One table per extra collection: <collection>_mirror(id, data, version, updated_at, source)
CREATE TABLE IF NOT EXISTS organizations_mirror (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'firebase'
);
CREATE INDEX IF NOT EXISTS idx_organizations_mirror_updated_at ON organizations_mirror(updated_at DESC);

CREATE TABLE IF NOT EXISTS classes_mirror (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'firebase'
);
CREATE INDEX IF NOT EXISTS idx_classes_mirror_updated_at ON classes_mirror(updated_at DESC);

CREATE TABLE IF NOT EXISTS sessions_mirror (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'firebase'
);
CREATE INDEX IF NOT EXISTS idx_sessions_mirror_updated_at ON sessions_mirror(updated_at DESC);
