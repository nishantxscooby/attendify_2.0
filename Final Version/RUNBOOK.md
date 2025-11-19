# Runbook

## 1. (Optional) Data Migration
- Python:
  ```bash
  cd "/Users/nishant/final1 - Copy/backend-test"
  export SQLITE_DB_PATH=/absolute/path/to/attendance_system.db
  export FIRESTORE_PROJECT_ID=your-project-id
  python sqlite_to_firestore.py
  ```
- Node (if converted to JS):
  ```bash
  node sqlite_to_firestore.js
  ```

## 2. Local Development
- **backend-test (Node Express + Firestore)**
  ```bash
  cd "/Users/nishant/final1 - Copy/backend-test"
  export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccountKey.json
  npm install
  npm start
  ```
- **frontend (Next.js + Firebase Web)**
  ```bash
  cd "/Users/nishant/final1 - Copy/frontend"
  npm install
  npm run dev
  ```
- **facenet_service (FastAPI mock/model)**
  ```bash
  cd "/Users/nishant/final1 - Copy/facenet_service"
  pip install -r requirements.txt
  uvicorn facenet_service:app --host 0.0.0.0 --port 8081
  ```
- **Smoke tests**
  ```bash
  curl http://localhost:8080/health
  curl "http://localhost:8080/attendance?sessionId=demo" -H "Authorization: Bearer <ID_TOKEN>"
  ```

## 3. Deploy
- **Backend(s) → Cloud Run**
  ```bash
  # Build & push backend-test image
  docker build -t "$REGION-docker.pkg.dev/$PROJECT_ID/attendance-backend/backend-test:$(git rev-parse --short HEAD)" backend-test
  docker push "$REGION-docker.pkg.dev/$PROJECT_ID/attendance-backend/backend-test:$(git rev-parse --short HEAD)"

  # Build & push FaceNet image
  docker build -t "$REGION-docker.pkg.dev/$PROJECT_ID/attendance-backend/facenet:$(git rev-parse --short HEAD)" facenet_service
  docker push "$REGION-docker.pkg.dev/$PROJECT_ID/attendance-backend/facenet:$(git rev-parse --short HEAD)"

  # Deploy FaceNet
  gcloud run deploy attendance-facenet \
    --image "$REGION-docker.pkg.dev/$PROJECT_ID/attendance-backend/facenet:$(git rev-parse --short HEAD)" \
    --region "$REGION" \
    --allow-unauthenticated

  # Capture FaceNet URL
  FACENET_URL=$(gcloud run services describe attendance-facenet --region "$REGION" --format='value(status.url)')

  # Deploy backend API with FACENET_URL
  gcloud run deploy attendance-api \
    --image "$REGION-docker.pkg.dev/$PROJECT_ID/attendance-backend/backend-test:$(git rev-parse --short HEAD)" \
    --region "$REGION" \
    --allow-unauthenticated \
    --set-env-vars FACENET_URL="$FACENET_URL"
  ```
- **Frontend → Firebase Hosting**
  ```bash
  cd "/Users/nishant/final1 - Copy/frontend"
  npm install
  npm run build
  npx next export -o out
  cd ..
  firebase deploy --only hosting
  ```

## 4. Troubleshooting
- **Firestore indexes & rules**: ensure `firebase deploy --only firestore` ran; check index build status in Firestore console; 403s often indicate missing custom claims or rules.
- **CORS issues**: confirm Cloud Run service has appropriate CORS headers or proxy via Firebase Hosting rewrites.
- **Rotate env vars**: use `gcloud run services update` with `--set-env-vars FACENET_URL=...` or `PROJECT_ID=...`; clear cached values in Cloud Run console if needed.
