# Firebase ↔ Postgres Sync Guide

## Prerequisites
- Render Postgres instance provisioned; copy the `DATABASE_URL` (must include `sslmode=require`).
- Firebase project with Firestore enabled; create a service account JSON and keep it outside version control.
- Node.js 18+, npm, Firebase CLI, and Python 3.10+ available locally.

## Apply Database Schema
```sh
psql "$DATABASE_URL" -f /Users/nishant/attendance_app/sql/schema.sql
```

## Firebase Functions Deployment
```sh
cd /Users/nishant/attendance_app/firebase/functions
npm install
firebase functions:config:set db.url="${DATABASE_URL}"
npm run build
firebase deploy --only functions
```

## FastAPI Sync Service
- Set environment variables (e.g. on Render or locally):
  - `DATABASE_URL=postgres://USER:PASS@HOST:5432/DB?sslmode=require`
  - `FIREBASE_ADMIN_JSON='{"type":"service_account",...}'`
- Install sync dependencies:
```sh
pip install -r /Users/nishant/attendance_app/attendance_backend/requirements-sync.txt
```
- Ensure `attendance_backend/app.py` imports the sync router (already configured) and run locally if desired:
```sh
uvicorn attendance_backend.app:app --host 0.0.0.0 --port 8080
```

## Backfill Historical Data
```sh
python /Users/nishant/attendance_app/scripts/backfill_firestore_to_postgres.py --collections attendance,users,courses --also-discovered
```

## Conflict Resolution
- Last write wins using `updated_at` (`TIMESTAMPTZ` stored in UTC); ties resolved by higher `version`.
- Mobile writes set `source='firebase'`; web writes bump `version` and set `source='web'`.

## Monitoring & Logging
- Cloud Functions log to Google Cloud Logging; filter for sync trigger names (e.g. `onAttendanceWrite`).
- FastAPI sync endpoints log failures with document IDs only; avoid logging secrets.

## Sample Sync Calls
```sh
# Upsert attendance
curl -X POST http://localhost:8080/sync/attendance/upsert \
  -H 'Content-Type: application/json' \
  -d '{"id":"att-001","userId":"user-1","courseId":"course-42","status":"present","version":1}'

# Remove a mirrored class document
curl -X DELETE http://localhost:8080/sync/classes/class-123

# Generic upsert into organizations mirror
curl -X POST http://localhost:8080/sync/organizations/upsert \
  -H 'Content-Type: application/json' \
  -d '{"id":"org-9","data":{"name":"Engineering","metadata":{"tz":"Asia/Kolkata"}}}'
```

## Additional Notes
- Store all server timestamps in UTC; convert to local time (Asia/Kolkata) in clients.
- Keep secrets out of source control; use environment variables or managed secrets.
- Idempotent upserts mean retries are safe across both systems.
