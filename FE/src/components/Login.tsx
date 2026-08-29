import { supabase } from "../lib/supabaseClient";

/**
 * Google OAuth covers both sign up and log in in one flow — the backend
 * creates the MailUser row on first callback if it doesn't exist yet
 * (BE/src/controllers/auth/authController.ts), so there's no separate
 * sign-up form to build.
 */
export default function Login() {
  const continueWithGoogle = () => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // The bare origin, not window.location.href: Supabase only returns to
        // URLs matching its redirect allowlist, and href drags along whatever
        // query string is on the page (`?letter=...`), which won't match the
        // registered entry. http://localhost:5173 must be allowlisted under
        // Authentication > URL Configuration in the Supabase dashboard.
        redirectTo: window.location.origin,
        queryParams: { prompt: "select_account" },
      },
    });
  };

  return (
    <div className="login-page">
      <p>Sign up or log in to U've Got Mail</p>
      <button type="button" onClick={continueWithGoogle}>
        Continue with Google
      </button>
    </div>
  );
}
