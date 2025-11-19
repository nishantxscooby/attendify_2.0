"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onSessionsWrite = exports.onClassesWrite = exports.onOrganizationsWrite = exports.onUserWrite = exports.onAttendanceWrite = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const pg_1 = require("pg");
admin.initializeApp();
const RESERVED_FIELDS = new Set([
    'updated_at',
    'updatedAt',
    'version',
    'source',
]);
let sharedPool = null;
function getPool() {
    if (!sharedPool) {
        const connectionString = functions.config().db?.url;
        if (!connectionString) {
            throw new Error('Missing runtime config value "db.url" for Postgres connection');
        }
        sharedPool = new pg_1.Pool({
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
function isFirestoreTimestamp(value) {
    return Boolean(value && typeof value === 'object' && typeof value.toDate === 'function');
}
function toDate(value) {
    if (!value)
        return null;
    if (value instanceof Date)
        return value;
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
function coerceVersion(value) {
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
function coerceSource(value) {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
    }
    return 'firebase';
}
function extractMetadata(snapshot, fallbackTimestamp, rawData) {
    const data = rawData ?? snapshot?.data() ?? {};
    const updatedAt = toDate(data.updated_at) ??
        toDate(data.updatedAt) ??
        (snapshot ? toDate(snapshot.updateTime) : null) ??
        (fallbackTimestamp ? toDate(fallbackTimestamp) : null) ??
        new Date();
    const version = coerceVersion(data.version);
    const source = coerceSource(data.source);
    return { version, source, updatedAt };
}
function serializeValue(value) {
    if (value === null || value === undefined)
        return value === undefined ? null : value;
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
        const entries = Object.entries(value)
            .map(([key, val]) => [key, serializeValue(val)])
            .filter(([, val]) => val !== undefined);
        return Object.fromEntries(entries);
    }
    return value;
}
async function upsertRow(table, row) {
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
async function deleteRow(table, id) {
    await getPool().query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}
function buildMirrorPayload(change, context) {
    if (!change.after.exists) {
        return null;
    }
    const id = context.params.docId;
    const data = change.after.data() ?? {};
    const metadata = extractMetadata(change.after, change.after.updateTime, data);
    return { id, data, metadata };
}
async function syncAttendance(change, context) {
    const docId = context.params.docId;
    if (!change.after.exists) {
        await deleteRow('attendance_event', docId);
        return;
    }
    const rawData = change.after.data() ?? {};
    const metadata = extractMetadata(change.after, change.after.updateTime, rawData);
    const userId = (rawData.userId ?? rawData.user_id);
    const courseId = (rawData.courseId ?? rawData.course_id ?? rawData.classId ?? rawData.sessionId);
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
async function syncUser(change, context) {
    const docId = context.params.docId;
    if (!change.after.exists) {
        await deleteRow('app_user', docId);
        return;
    }
    const rawData = change.after.data() ?? {};
    const metadata = extractMetadata(change.after, change.after.updateTime, rawData);
    const email = rawData.email;
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
function sanitiseData(data) {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
        if (RESERVED_FIELDS.has(key)) {
            continue;
        }
        result[key] = serializeValue(value);
    }
    return result;
}
async function syncMirrorCollection(collection, change, context) {
    const docId = context.params.docId;
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
async function handleTrigger(fn) {
    try {
        await fn();
    }
    catch (error) {
        console.error('Failed to process sync trigger', error);
        throw error;
    }
}
exports.onAttendanceWrite = functions.firestore
    .document('attendance/{docId}')
    .onWrite((change, context) => handleTrigger(() => syncAttendance(change, context)));
exports.onUserWrite = functions.firestore
    .document('users/{docId}')
    .onWrite((change, context) => handleTrigger(() => syncUser(change, context)));
exports.onOrganizationsWrite = functions.firestore
    .document('organizations/{docId}')
    .onWrite((change, context) => handleTrigger(() => syncMirrorCollection('organizations', change, context)));
exports.onClassesWrite = functions.firestore
    .document('classes/{docId}')
    .onWrite((change, context) => handleTrigger(() => syncMirrorCollection('classes', change, context)));
exports.onSessionsWrite = functions.firestore
    .document('sessions/{docId}')
    .onWrite((change, context) => handleTrigger(() => syncMirrorCollection('sessions', change, context)));
