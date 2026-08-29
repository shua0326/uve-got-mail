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
      // Matches the known-working BE/src/server.ts `/login-test` page, which
      // uses the exact current URL rather than the bare origin.
      provider: "google",
      options: { redirectTo: window.location.href },
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
