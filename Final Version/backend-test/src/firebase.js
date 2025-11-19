import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

let app;

function initializeAdmin() {
  if (app) return app;

  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const options = {};

  if (credentialPath) {
    options.credential = admin.credential.cert(credentialPath);
  }

  app = admin.apps.length ? admin.app() : admin.initializeApp(options);
  return app;
}

initializeAdmin();

export const firestore = getFirestore();

export async function verifyIdToken(req, res, next) {
  const authHeader = req.header("Authorization") || "";
  const [scheme, token] = authHeader.split(" ");

  if (!token || scheme.toLowerCase() !== "bearer") {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseClaims = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired Firebase ID token" });
  }
}
