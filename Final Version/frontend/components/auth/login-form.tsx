'use client';

import React, { useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'https://attendance-api-ns3v.onrender.com';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
};

if (!getApps().length) initializeApp(firebaseConfig);

export function LoginForm() {
  const [role, setRole] = useState<'admin' | 'teacher' | 'student' | ''>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>(''); // debug area
  const [err, setErr] = useState<string>('');

  function log(s: string) {
    console.log(s);
    setMsg((p) => (p ? `${p}\n${s}` : s));
  }

  async function doLogin(e?: React.FormEvent) {
    e?.preventDefault();
    setErr('');
    setMsg('');
    setBusy(true);

    try {
      log(`boot start`);
      log(`healthz fetch…`);
      const hz = await fetch(`${API_BASE}/healthz`).then((r) => r.text());
      log(`healthz = ${hz}`);

      log(`firebase init…`);
      const auth = getAuth();

      log(`signInWithEmailAndPassword… ${email}`);
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

      const token = await cred.user.getIdToken(true);
      log(`got idToken (len) ${token.length}`);

      log(`GET /me…`);
      const meRes = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const text = await meRes.text();
      log(`GET /me status ${meRes.status} body ${text}`);

      if (!meRes.ok) throw new Error(`/me failed: ${meRes.status} ${text}`);

      const me = JSON.parse(text) as { uid: string; role: string | null };

      const resolvedRole = (me.role || role || '').toLowerCase() as
        | 'admin'
        | 'teacher'
        | 'student';

      if (!resolvedRole) throw new Error('No role assigned to this user.');

      localStorage.setItem('idToken', token);
      localStorage.setItem('uid', me.uid);
      localStorage.setItem('role', resolvedRole);

      const dest =
        resolvedRole === 'admin'
          ? '/admin'
          : resolvedRole === 'teacher'
          ? '/teacher'
          : '/student';

      log(`navigate -> ${dest}`);
      window.location.assign(dest);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || 'Sign-in failed');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={doLogin} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">User Type</label>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
          >
            <option value="">Select your role</option>
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Username (email)</label>
          <input
            type="email"
            placeholder="test123@example.com"
            className="w-full rounded-md border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            className="w-full rounded-md border px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      {err ? (
        <pre className="whitespace-pre-wrap break-words text-red-600 text-sm">
          {err}
        </pre>
      ) : null}

      {msg ? (
        <pre className="whitespace-pre-wrap break-words text-xs bg-black/5 p-2 rounded">
          {msg}
        </pre>
      ) : null}
    </div>
  );
}
