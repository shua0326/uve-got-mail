import { useState } from "react";
import { updateUsername, UsernameTakenError, type AuthUser } from "../api";

/**
 * Shown once, right after a first login: the backend seeds `username` with
 * the account's email (BE/src/controllers/auth/authController.ts), so until
 * the user picks a real one every screen would address them by email
 * address. Gated in App.tsx by `needsUsername`.
 */
export default function SetUsername({
  user,
  onDone,
  onSignOut,
}: {
  user: AuthUser;
  onDone: (updated: AuthUser) => void;
  onSignOut: () => void;
}) {
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = username.trim();
  // An email is what the account already has; letting it through would make
  // the gate re-fire on the next login.
  const invalid =
    trimmed.length < 3 || trimmed.length > 24 || !/^[a-zA-Z0-9._-]+$/.test(trimmed);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (invalid || saving) return;
    setSaving(true);
    setError(null);
    try {
      onDone(await updateUsername(user.id, trimmed));
    } catch (err) {
      setError(
        err instanceof UsernameTakenError
          ? err.message
          : `Couldn't save that username (${String(err)}).`,
      );
      setSaving(false);
    }
  }

  return (
    <div className="login-page">
      <h2 className="set-username-title">Pick a username</h2>
      <p className="set-username-hint">
        This is how other people will find and address you on U've Got Mail.
      </p>
      <form className="set-username-form" onSubmit={handleSubmit}>
        <input
          className="set-username-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          autoFocus
          autoComplete="off"
          disabled={saving}
        />
        <button type="submit" disabled={invalid || saving}>
          {saving ? "Saving…" : "Continue"}
        </button>
      </form>
      <p className="set-username-hint">
        3–24 characters; letters, numbers, dots, dashes and underscores.
      </p>
      {error && <p className="set-username-error">{error}</p>}
      <button type="button" className="set-username-signout" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}
