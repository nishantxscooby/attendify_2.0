// frontend/lib/firebase.ts
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  type Auth,
} from "firebase/auth";

// Read & validate env (build-time)
const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

for (const [k, v] of Object.entries(cfg)) {
  if (!v || String(v).trim() === "") {
    // Clear, early failure so you know exactly what's missing
    throw new Error(`[firebase.ts] Missing env: ${k}`);
  }
}

let app: FirebaseApp | undefined;
let _auth: Auth | undefined;

function init() {
  if (app) return;
  app = initializeApp(cfg);
  _auth = getAuth(app);

  // Tiered persistence for maximum compatibility (Safari/Private Mode, etc.)
  if (typeof window !== "undefined") {
    (async () => {
      try {
        await setPersistence(_auth!, indexedDBLocalPersistence);
      } catch {
        try {
          await setPersistence(_auth!, browserLocalPersistence);
        } catch {
          await setPersistence(_auth!, browserSessionPersistence);
        }
      }
    })();
  }
}

init();

// Always export a concrete Auth (never null)
export const auth: Auth = _auth!;
