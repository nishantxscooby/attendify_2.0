import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence, serverTimestamp } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: run `firebase init` and copy the config values from the Firebase console.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "YOUR_API_KEY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "YOUR_PROJECT.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "YOUR_PROJECT_ID",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "YOUR_PROJECT.appspot.com",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch(() => {
    // IndexedDB persistence can fail in private/incognito mode; fall back silently.
  });
}

export { app, auth, db, storage, serverTimestamp };
