import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import type { AuthUser } from "../api";

export type SessionStatus = "loading" | "signed-out" | "signed-in";

/**
 * Tracks the Supabase session and mirrors BE/src/server.ts's `/login-test`
 * verification step: every time a session appears, POST it to
 * `/auth/callback` so the backend creates the matching `MailUser` row
 * (BE/src/controllers/auth/authController.ts). A 401 here means Supabase
 * has a locally cached session the backend no longer accepts, so it's
 * cleared rather than left stuck.
 *
 * The callback's `{ user: { id, email, username } }` body is kept as `user`
 * — App.tsx reads it to decide whether the account still needs a username
 * picked (see `needsUsername` in api.ts).
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [backendError, setBackendError] = useState<string | null>(null);
  const verifiedFor = useRef<string | null>(null);
  // `getSession()` and `onAuthStateChange`'s initial event both land here,
  // so without this the very first sign-in fires two concurrent
  // POST /auth/callback requests. `verifiedFor` can't stop them — it is only
  // set once a response comes back, by which time both are already in flight.
  const inFlight = useRef<Map<string, Promise<void>>>(new Map());

  useEffect(() => {
    let cancelled = false;

    function verifyWithBackend(next: Session): Promise<void> {
      if (verifiedFor.current === next.user.id) return Promise.resolve();
      const pending = inFlight.current.get(next.user.id);
      if (pending) return pending;
      const run = verifyOnce(next).finally(() => {
        inFlight.current.delete(next.user.id);
      });
      inFlight.current.set(next.user.id, run);
      return run;
    }

    async function verifyOnce(next: Session) {
      try {
        const res = await fetch("/auth/callback", {
          method: "POST",
          headers: { Authorization: `Bearer ${next.access_token}` },
        });
        if (res.status === 401) {
          await supabase.auth.signOut();
          return;
        }
        if (!res.ok) {
          // Reachable but unhappy (proxy misconfigured, backend throwing).
          // Deliberately NOT marked verified, so the next auth event retries
          // instead of leaving `user` null for the rest of the session.
          throw new Error(`/auth/callback responded ${res.statusText}`);
        }
        const body = await res.json();
        if (cancelled) return;
        if (body?.user) setUser(body.user as AuthUser);
        setBackendError(null);
        verifiedFor.current = next.user.id;
      } catch (err) {
        // Backend unreachable — keep the FE session as-is rather than
        // signing the user out over a network blip. `user` stays null, which
        // App.tsx reads as "don't know yet" rather than "no username needed".
        console.error("Failed to verify session with backend", err);
        if (!cancelled) setBackendError(String(err));
      }
    }

    supabase.auth.getSession().then(({ data: { session: initial } }) => {
      if (cancelled) return;
      setSession(initial);
      setStatus(initial ? "signed-in" : "signed-out");
      if (initial) void verifyWithBackend(initial);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      if (cancelled) return;
      setSession(next);
      setStatus(next ? "signed-in" : "signed-out");
      if (next) void verifyWithBackend(next);
      else {
        verifiedFor.current = null;
        setUser(null);
        setBackendError(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    /** The backend's `MailUser` row, once `/auth/callback` has answered. */
    user,
    /** Called after the set-username page saves, so the gate stops firing. */
    setUser: useCallback((next: AuthUser) => setUser(next), []),
    status,
    /** Set when /auth/callback couldn't be reached or errored. */
    backendError,
    signOut: () => supabase.auth.signOut(),
  };
}
