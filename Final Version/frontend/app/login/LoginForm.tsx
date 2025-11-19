// frontend/app/login/LoginForm.tsx
"use client";

import { useState, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseApp = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
});

const API = process.env.NEXT_PUBLIC_API_URL!; // https://attendance-api-ns3v.onrender.com

export default function LoginForm() {
  const [email, setEmail] = useState("test123@example.com");
  const [password, setPassword] = useState("test123");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSignIn = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);

      const auth = getAuth(firebaseApp);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken(true);

      // Persist for dashboards to read
      localStorage.setItem("idToken", idToken);

      // Ask backend who I am
      const meRes = await fetch(`${API}/me`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!meRes.ok) throw new Error(`/me failed: ${meRes.status}`);
      const me = await meRes.json();

      localStorage.setItem("role", me.role ?? "");

      // Decide destination
      const dest =
        me.role === "Admin"
          ? "/admin"
          : me.role === "Teacher"
          ? "/teacher"
          : "/student";

      // Hard redirect (more reliable on static export than router.push)
      window.location.assign(dest);
    } catch (e: any) {
      console.error(e);
      setErr(e.message || "Login failed");
      setLoading(false);
    }
  }, [email, password]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault(); // important
        onSignIn();
      }}
      // also safe if user presses Enter
      className="space-y-4"
    >
      {/* ... your inputs ... */}
      <button
        type="button"           // <- prevents native submit
        onClick={onSignIn}
        disabled={loading}
        className="w-full"
      >
        {loading ? "Signing in…" : "Sign In"}
      </button>
      {err && <p className="text-red-600">{err}</p>}
    </form>
  );
}
