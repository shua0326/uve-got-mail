import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

export type SessionStatus = "loading" | "signed-out" | "signed-in";

/**
 * Tracks the Supabase session and mirrors BE/src/server.ts's `/login-test`
 * verification step: every time a session appears, POST it to
 * `/auth/callback` so the backend creates the matching `MailUser` row
 * (BE/src/controllers/auth/authController.ts). A 401 here means Supabase
 * has a locally cached session the backend no longer accepts, so it's
 * cleared rather than left stuck.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const verifiedFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verifyWithBackend(next: Session) {
      if (verifiedFor.current === next.user.id) return;
      try {
        const res = await fetch("/auth/callback", {
          method: "POST",
          headers: { Authorization: `Bearer ${next.access_token}` },
        });
        if (res.status === 401) {
          await supabase.auth.signOut();
          return;
        }
        verifiedFor.current = next.user.id;
      } catch (err) {
        // Backend unreachable — keep the FE session as-is rather than
        // signing the user out over a network blip.
        console.error("Failed to verify session with backend", err);
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
      else verifiedFor.current = null;
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    status,
    signOut: () => supabase.auth.signOut(),
  };
}
