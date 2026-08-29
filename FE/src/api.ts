import { decode } from "./replay/codec";
import type { Recording } from "./replay/format";
import { supabase } from "./lib/supabaseClient";

// Relative — routed through Vite's dev proxy (vite.config.ts) so requests
// stay same-origin.
const API_BASE = "";

// Attaches the current Supabase session's access token, if any, to a
// backend request. Sent on every call (not just the routes BE currently
// guards with requireAuth) so nothing needs to change on the FE side when
// the backend adds auth to a route it doesn't check yet.
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

/**
 * Send a composed letter. There is no standalone recording upload on the
 * backend: `POST /mail/:recipientId` takes the gzipped bytes as the body and
 * saves the Recording *and* the Mail row in one call
 * (BE/src/controllers/mail/mailController.ts `sendMail`), answering with the
 * new mail's id.
 */
export async function sendLetter(recipientId: string, blob: Blob): Promise<number> {
  const res = await fetch(`${API_BASE}/mail/${encodeURIComponent(recipientId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", ...(await authHeaders()) },
    body: blob,
  });
  if (!res.ok) throw new Error(`Sending the letter failed (${res.status})`);
  const { id } = await res.json();
  return id as number;
}

/**
 * Download a letter's gzipped bytes. The path parameter is the **Recording**
 * id (`Mail.recordingId`), not the mail's own id — `getMail` looks the row up
 * with `getRecording(id)`.
 */
export async function fetchRecording(recordingId: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const res = await fetch(`${API_BASE}/mail/${encodeURIComponent(recordingId)}`, {
    signal,
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Recording fetch failed: ${res.status}`);
  return res.arrayBuffer();
}

/** Fetch + gunzip + parse a letter in one step. */
export async function loadLetter(recordingId: string, signal?: AbortSignal): Promise<Recording> {
  const buf = await fetchRecording(recordingId, signal);
  return decode(buf);
}

// --- Mail (BE/src/routes/mailRoutes.ts, mounted at /mail behind requireAuth)
//
// `GET /mail` returns the current *delivery window*: every letter addressed to
// the caller with `received: true`. The scheduled-delivery service flips that
// flag for the batch due at the recipient's `MailUser.scheduledMail` time, and
// the batch stays readable — and re-readable — until the next delivery
// replaces it. Read letters are therefore still in the list; `read` only
// drives the unread badge.

export interface MailUserSummary {
  id: string;
  username: string;
  email: string;
}

/** A row from `GET /mail` — Prisma's `Mail` plus the included `sender`. */
export interface MailListItem {
  id: number;
  sentAt: string;
  read: boolean;
  received: boolean;
  senderId: string;
  recipientId: string;
  historyId: string;
  /** Points at the `Recording` row; pass it to `loadLetter`, not `id`. */
  recordingId: string;
  sender: MailUserSummary;
}

/** The letters delivered in the caller's current window, oldest first. */
export async function fetchInbox(signal?: AbortSignal): Promise<MailListItem[]> {
  const res = await fetch(`${API_BASE}/mail`, { signal, headers: await authHeaders() });
  if (!res.ok) throw new Error(`Inbox fetch failed: ${res.status}`);
  return (await res.json()) as MailListItem[];
}

/** Marks one letter read. The letter stays in the window either way — this
 * only clears its unread badge. */
export async function markMailRead(mailId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/mail/${mailId}/read`, {
    method: "PUT",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Couldn't mark that letter read (${res.status})`);
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

/** Resolves a typed username to the id `sendLetter` needs.
 * `GET /user/by-username/:username` — 404 when nobody has that name. */
export async function findUserByUsername(username: string): Promise<MailUserSummary | null> {
  const res = await fetch(`${API_BASE}/user/by-username/${encodeURIComponent(username)}`, {
    headers: await authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Couldn't look that username up (${res.status})`);
  return (await res.json()) as MailUserSummary;
}

/** The signed-in user's friends, for the compose recipient picker.
 * `GET /user/me/friends` unions both sides of the friends self-relation. */
export async function fetchFriends(signal?: AbortSignal): Promise<MailUserSummary[]> {
  const res = await fetch(`${API_BASE}/user/me/friends`, { signal, headers: await authHeaders() });
  if (!res.ok) throw new Error(`Couldn't load your friends (${res.status})`);
  return (await res.json()) as MailUserSummary[];
}

// --- Friend requests (BE/src/routes/friendRequestRoutes.ts, mounted at
// --- /friends behind `requireAuth`) ------------------------------------

/** A row from `GET /friends`. The backend's `getFriendRequests` includes the
 * `sender` relation so the list can show a name rather than a raw uuid. */
export interface FriendRequestItem {
  id: string;
  senderId: string;
  recipientId: string;
  sender: MailUserSummary;
}

/** Carries the backend's own `message` so the Add-friend toast can say which
 * of the several 400s happened (already sent / sent to yourself / …) rather
 * than collapsing them into one generic failure. */
export class FriendRequestError extends Error {
  // Declared rather than a `readonly` constructor parameter property:
  // tsconfig.app.json turns on `erasableSyntaxOnly`, which rejects those.
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FriendRequestError";
    this.status = status;
  }
}

/** The `{ message }` body every friendRequestController error path returns. */
async function friendRequestError(res: Response, fallback: string): Promise<FriendRequestError> {
  let message = fallback;
  try {
    const body = await res.json();
    if (typeof body?.message === "string") message = body.message;
  } catch {
    // Non-JSON body (proxy error page, empty 502) — keep the fallback.
  }
  return new FriendRequestError(message, res.status);
}

/** Friend requests addressed to the signed-in user. */
export async function fetchFriendRequests(signal?: AbortSignal): Promise<FriendRequestItem[]> {
  const res = await fetch(`${API_BASE}/friends`, { signal, headers: await authHeaders() });
  if (!res.ok) throw await friendRequestError(res, `Couldn't load friend requests (${res.status})`);
  return (await res.json()) as FriendRequestItem[];
}

/**
 * Look a username up and, if it exists, send it a friend request.
 * The lookup and the send are the same call — `sendFriendRequest` resolves
 * the username server-side and 404s when no such `MailUser` exists.
 */
export async function sendFriendRequest(username: string): Promise<void> {
  const res = await fetch(`${API_BASE}/friends/send/${encodeURIComponent(username)}`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (res.status === 404) {
    throw new FriendRequestError(`No user found with the username "${username}".`, 404);
  }
  if (!res.ok) throw await friendRequestError(res, `Couldn't send the friend request (${res.status})`);
}

export async function acceptFriendRequest(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/friends/${encodeURIComponent(id)}/accept`, {
    method: "PUT",
    headers: await authHeaders(),
  });
  if (!res.ok) throw await friendRequestError(res, `Couldn't accept that request (${res.status})`);
}

export async function declineFriendRequest(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/friends/${encodeURIComponent(id)}/decline`, {
    method: "PUT",
    headers: await authHeaders(),
  });
  if (!res.ok) throw await friendRequestError(res, `Couldn't decline that request (${res.status})`);
}
