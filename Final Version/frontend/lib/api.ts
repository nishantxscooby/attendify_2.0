const FALLBACK_BASE =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:5000";

function getNextEnv(): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env?.NEXT_PUBLIC_API_URL;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

const HAS_BACKEND = !!getNextEnv();

export function getApiBase(): string {
  const base = getNextEnv() ?? FALLBACK_BASE;
  return base.replace(/\/$/, "");
}

export function resolveApiUrl(path: string): string {
  const base = getApiBase();
  if (/^https?:\/\//i.test(path)) return path;
  let rel = path.startsWith("/") ? path : `/${path}`;
  const trimmed = base.replace(/\/+$/, "");
  const baseHasApi = /\/api$/i.test(trimmed);
  if (baseHasApi && rel.startsWith("/api/")) rel = rel.slice(4);
  else if (baseHasApi && rel === "/api") rel = "";
  return `${trimmed}${rel}`;
}

export async function apiFetch(path: string, init?: RequestInit) {
  if (!HAS_BACKEND && /^\/?api(\/|$)/i.test(path)) {
    return new Response(null, { status: 204 });
  }
  return fetch(resolveApiUrl(path), init);
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed with ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}
