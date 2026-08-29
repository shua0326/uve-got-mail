import { supabase } from "../lib/supabaseClient";
import { Button } from "./pouf/Button";
import { Card } from "./pouf/surface";
import { Stack } from "./pouf/layout";
import { Blob } from "./pouf/media";
import { Heading, Text } from "./pouf/text";

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
    <div className="page-center">
      <Card>
        <Stack gap={4}>
          {/* Wax rose rather than the default violet: at 80px and fully
              round (theme-letter.css §7) the Blob reads as a seal, and a
              seal on a letter is wax. Decorative only — it carries no label
              and is aria-hidden, so the tone is free of any semantic duty. */}
          <Blob icon="mail" tone="pink" size="lg" />
          <Heading level={1}>
            <span className="wordmark">uve got mail!</span>
          </Heading>
          <Text muted>
            Letters you draw by hand, delivered once a day at a time you don't get to
            pick. Take your time over them — nobody is waiting on a read receipt.
          </Text>
          <Button block tone="purple" size="lg" onClick={continueWithGoogle}>
            Continue with Google
          </Button>
        </Stack>
      </Card>
    </div>
  );
}
