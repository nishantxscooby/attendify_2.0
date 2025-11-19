import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Pool } from 'pg';

admin.initializeApp();

type FirestoreDocument = admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>;
type FirestoreChange = functions.Change<FirestoreDocument>;

type SyncMetadata = {
  version: number;
  source: string;
  updatedAt: Date;
};

type MirrorPayload = {
  id: string;
  metadata: SyncMetadata;
  data?: admin.firestore.DocumentData;
};

const RESERVED_FIELDS = new Set<string>([
  'updated_at',
  'updatedAt',
  'version',
  'source',
]);

let sharedPool: Pool | null = null;

function getPool(): Pool {
  if (!sharedPool) {
    const connectionString = functions.config().db?.url;
    if (!connectionString) {
      throw new Error('Missing runtime config value "db.url" for Postgres connection');
    }
    sharedPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
    sharedPool.on('error', (error) => {
      console.error('Unexpected Postgres pool error', error);
    });
  }
  return sharedPool;
}

function isFirestoreTimestamp(value: unknown): value is admin.firestore.Timestamp {
  return Boolean(value && typeof value === 'object' && typeof (value as admin.firestore.Timestamp).toDate === 'function');
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (isFirestoreTimestamp(value)) {
    return value.toDate();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function coerceVersion(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 1;
}

function coerceSource(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return 'firebase';
}

function extractMetadata(snapshot: FirestoreDocument | null, fallbackTimestamp?: admin.firestore.Timestamp | null, rawData?: admin.firestore.DocumentData): SyncMetadata {
  const data = rawData ?? snapshot?.data() ?? {};
  const updatedAt =
    toDate(data.updated_at) ??
    toDate(data.updatedAt) ??
    (snapshot ? toDate(snapshot.updateTime) : null) ??
    (fallbackTimestamp ? toDate(fallbackTimestamp) : null) ??
    new Date();
  const version = coerceVersion(data.version);
  const source = coerceSource(data.source);
  return { version, source, updatedAt };
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value === undefined ? null : value;
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (isFirestoreTimestamp(value)) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => [key, serializeValue(val)])
      .filter(([, val]) => val !== undefined);
    return Object.fromEntries(entries);
  }
  return value;
}

async function upsertRow(table: string, row: Record<string, unknown>): Promise<void> {
  const columns = Object.keys(row);
  if (!columns.length) {
    throw new Error(`Attempted to upsert empty row into ${table}`);
  }
  const values = columns.map((column) => row[column]);
  const insertColumns = columns.join(', ');
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  const updateAssignments = columns
    .filter((column) => column !== 'id')
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(', ');
  const sql = `INSERT INTO ${table} (${insertColumns}) VALUES (${placeholders}) ` +
    `ON CONFLICT (id) DO UPDATE SET ${updateAssignments} ` +
    `WHERE EXCLUDED.updated_at > ${table}.updated_at ` +
    `OR (EXCLUDED.updated_at = ${table}.updated_at AND EXCLUDED.version > ${table}.version)`;
  await getPool().query(sql, values);
}

async function deleteRow(table: string, id: string): Promise<void> {
  await getPool().query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

function buildMirrorPayload(change: FirestoreChange, context: functions.EventContext): MirrorPayload | null {
  if (!change.after.exists) {
    return null;
  }
  const id = context.params.docId as string;
  const data = change.after.data() ?? {};
  const metadata = extractMetadata(change.after, change.after.updateTime, data);
  return { id, data, metadata };
}

async function syncAttendance(change: FirestoreChange, context: functions.EventContext): Promise<void> {
  const docId = context.params.docId as string;
  if (!change.after.exists) {
    await deleteRow('attendance_event', docId);
    return;
  }

  const rawData = change.after.data() ?? {};
  const metadata = extractMetadata(change.after, change.after.updateTime, rawData);

  const userId = (rawData.userId ?? rawData.user_id) as string | undefined;
  const courseId = (rawData.courseId ?? rawData.course_id ?? rawData.classId ?? rawData.sessionId) as string | undefined;
  const statusRaw = rawData.status ?? 'unknown';
  const tsUtcSource = rawData.tsUtc ?? rawData.ts_utc ?? rawData.capturedAt ?? rawData.timestamp;
  const tsUtc = toDate(tsUtcSource) ?? metadata.updatedAt;

  if (!userId || !courseId) {
    console.warn('Skipping attendance_event upsert due to missing userId/courseId', {
      id: docId,
      userId,
      courseId,
    });
    return;
  }

  const row = {
    id: docId,
    user_id: String(userId),
    course_id: String(courseId),
    status: String(statusRaw),
    ts_utc: tsUtc,
    version: metadata.version,
    updated_at: metadata.updatedAt,
    source: metadata.source,
  };

  await upsertRow('attendance_event', row);
}

async function syncUser(change: FirestoreChange, context: functions.EventContext): Promise<void> {
  const docId = context.params.docId as string;
  if (!change.after.exists) {
    await deleteRow('app_user', docId);
    return;
  }

  const rawData = change.after.data() ?? {};
  const metadata = extractMetadata(change.after, change.after.updateTime, rawData);
  const email = rawData.email as string | undefined;
  if (!email) {
    console.warn('Skipping app_user upsert because email is missing', { id: docId });
    return;
  }

  const displayName = rawData.displayName ?? rawData.display_name ?? null;
  const role = rawData.role ?? null;

  const row = {
    id: docId,
    email: String(email).toLowerCase(),
    display_name: displayName ? String(displayName) : null,
    role: role ? String(role) : null,
    version: metadata.version,
    updated_at: metadata.updatedAt,
    source: metadata.source,
  };

  await upsertRow('app_user', row);
}

function sanitiseData(data: admin.firestore.DocumentData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (RESERVED_FIELDS.has(key)) {
      continue;
    }
    result[key] = serializeValue(value);
  }
  return result;
}

async function syncMirrorCollection(collection: string, change: FirestoreChange, context: functions.EventContext): Promise<void> {
  const docId = context.params.docId as string;
  const table = `${collection}_mirror`;

  if (!change.after.exists) {
    await deleteRow(table, docId);
    return;
  }

  const payload = buildMirrorPayload(change, context);
  if (!payload) {
    return;
  }

  const data = payload.data ? sanitiseData(payload.data) : {};
  const row = {
    id: payload.id,
    data: JSON.stringify(data),
    version: payload.metadata.version,
    updated_at: payload.metadata.updatedAt,
    source: payload.metadata.source,
  };

  await upsertRow(table, row);
}

async function handleTrigger(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error('Failed to process sync trigger', error);
    throw error;
  }
}

export const onAttendanceWrite = functions.firestore
  .document('attendance/{docId}')
  .onWrite((change, context) => handleTrigger(() => syncAttendance(change, context)));

export const onUserWrite = functions.firestore
  .document('users/{docId}')
  .onWrite((change, context) => handleTrigger(() => syncUser(change, context)));

export const onOrganizationsWrite = functions.firestore
  .document('organizations/{docId}')
  .onWrite((change, context) => handleTrigger(() => syncMirrorCollection('organizations', change, context)));

export const onClassesWrite = functions.firestore
  .document('classes/{docId}')
  .onWrite((change, context) => handleTrigger(() => syncMirrorCollection('classes', change, context)));

export const onSessionsWrite = functions.firestore
  .document('sessions/{docId}')
  .onWrite((change, context) => handleTrigger(() => syncMirrorCollection('sessions', change, context)));
