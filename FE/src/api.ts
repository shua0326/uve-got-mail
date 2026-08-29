import { decode } from "./replay/codec";
import type { Recording } from "./replay/format";
import { SAMPLE_RECORDING, SAMPLE_RECORDING_ID } from "./data/sampleRecording";
import { supabase } from "./lib/supabaseClient";

// Relative — routed through Vite's dev proxy (vite.config.ts) so requests
// stay same-origin. See IMPLEMENTATION_PLAN.md §8.
const API_BASE = "";

// Attaches the current Supabase session's access token, if any, to a
// backend request. Sent on every call (not just the routes BE currently
// guards with requireAuth) so nothing needs to change on the FE side when
// the backend adds auth to a route it doesn't check yet — see the auth
// footnote in IMPLEMENTATION_PLAN.md for which routes that is today.
async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export interface GiphyImage {
  url: string;
  width: string;
  height: string;
}

export interface GiphyResult {
  id: string;
  title: string;
  is_sticker?: number;
  images: {
    fixed_height: GiphyImage;
  };
}

export async function searchGiphy(
  query: string,
  type: "gifs" | "stickers",
): Promise<GiphyResult[]> {
  const url = new URL(`${API_BASE}/giphy/search`, window.location.origin);
  url.searchParams.set("q", query);
  url.searchParams.set("type", type);

  const res = await fetch(url, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`Giphy search failed: ${res.status}`);
  const body = await res.json();
  return (body.data ?? []) as GiphyResult[];
}

export async function uploadRecording(blob: Blob): Promise<string> {
  const res = await fetch(`${API_BASE}/recordings`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", ...(await authHeaders()) },
    body: blob,
  });
  if (!res.ok) throw new Error(`Recording upload failed: ${res.status}`);
  const { id } = await res.json();
  return id as string;
}

export async function fetchRecording(id: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const res = await fetch(`${API_BASE}/recordings/${id}`, { signal, headers: await authHeaders() });
  if (!res.ok) throw new Error(`Recording fetch failed: ${res.status}`);
  return res.arrayBuffer();
}

/** Fetch + gunzip + parse a recording in one step. */
export async function loadLetter(id: string, signal?: AbortSignal): Promise<Recording> {
  // The inbox's mock-data fallback (§14) points at a bundled fixture rather
  // than a real uploaded recording — serve it locally instead of hitting a
  // /recordings id that was never uploaded and will always 404.
  if (id === SAMPLE_RECORDING_ID) return SAMPLE_RECORDING;
  const buf = await fetchRecording(id, signal);
  return decode(buf);
}

// --- Mail (IMPLEMENTATION_PLAN.md §6.3 / §8) ---------------------------
//
// The backend does not yet expose /mail routes (only Prisma's `Mail` /
// `MailUser` models exist — see prisma/schema.prisma). This client is
// written against the contract that model implies so the inbox works the
// moment the route lands: `requireAuth`, returns mail addressed to the
// caller with the sender relation included. `Mail` has no timestamp field,
// so recency is inferred from the autoincrementing `id`.

export interface MailUserSummary {
  id: string;
  username: string;
  email: string;
}

export interface MailListItem {
  id: number;
  content: string; // recording id (see IMPLEMENTATION_PLAN.md — Mail.content
                    // is the natural home for this until a dedicated
                    // recording relation exists on Mail)
  read: boolean;
  received: boolean;
  sender: MailUserSummary;
}

export async function fetchInbox(): Promise<MailListItem[]> {
  const res = await fetch(`${API_BASE}/mail/inbox`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`Inbox fetch failed: ${res.status}`);
  return (await res.json()) as MailListItem[];
}

// --- User (BE/src/routes/mailUserRoutes.ts, mounted at /user) -----------

/** The `user` object `POST /auth/callback` echoes back. On first login the
 * backend seeds `username` with the email (authController.ts), which is the
 * signal that the user still needs to pick one. */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

/** A freshly created account has `username === email` — see
 * BE/src/controllers/auth/authController.ts. */
export function needsUsername(user: AuthUser): boolean {
  return user.username === user.email;
}

export class UsernameTakenError extends Error {
  constructor() {
    super("That username is already taken.");
    this.name = "UsernameTakenError";
  }
}

export async function updateUsername(userId: string, username: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/user/${encodeURIComponent(userId)}/username`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ username }),
  });
  if (res.status === 409) throw new UsernameTakenError();
  if (!res.ok) throw new Error(`Couldn't save username (${res.status})`);
  return (await res.json()) as AuthUser;
}
