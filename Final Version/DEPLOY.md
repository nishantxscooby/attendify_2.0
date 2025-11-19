# Deployment Guide

> Prerequisites: gcloud CLI, Firebase CLI, Docker (buildx), and npm installed on macOS.

## 1. Authenticate & Configure Project
```bash
# Login to Google Cloud
gcloud auth login

# Select project
export PROJECT_ID=your-project-id
export REGION=us-central1   # adjust as needed

gcloud config set project "$PROJECT_ID"
```

## 2. Enable Required APIs
```bash
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

## 3. Create Artifact Registry Repository
```bash
export REPO_NAME=attendance-backend

gcloud artifacts repositories create "$REPO_NAME" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Attendance backend images"
```

## 4. Build & Push Docker Images
```bash
cd "/Users/nishant/final1 - Copy"

# Backend API image
export API_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/backend-test:v1"
docker build -t "$API_IMAGE" backend-test

gcloud auth configure-docker "$REGION-docker.pkg.dev"
docker push "$API_IMAGE"

# FaceNet service image
export FACENET_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/facenet-service:v1"
docker build -t "$FACENET_IMAGE" facenet_service
docker push "$FACENET_IMAGE"
```

## 5. Deploy to Cloud Run
```bash
# FaceNet (deployed first to capture URL)
FACENET_SERVICE=attendance-facenet

gcloud run deploy "$FACENET_SERVICE" \
  --image "$FACENET_IMAGE" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated

FACENET_URL=$(gcloud run services describe "$FACENET_SERVICE" \
  --region "$REGION" \
  --format='value(status.url)')

gcloud run deploy attendance-api \
  --image "$API_IMAGE" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars FACENET_URL="$FACENET_URL"
```

## 6. Build & Deploy Frontend (Firebase Hosting)
```bash
cd "/Users/nishant/final1 - Copy/frontend"
npm install
npm run build
npx next export -o out

cd ..
# Ensure firebase.json/.firebaserc are configured
firebase deploy --only hosting
```

## 7. Verify
- Check Cloud Run services via `gcloud run services list --region $REGION`.
- Test API endpoints (`/health`, `/me`, `/attendance`).
- Confirm Hosting URL via `firebase hosting:sites:list` or Firebase console.
