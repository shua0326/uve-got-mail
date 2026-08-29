/**
 * The username rule, in one place.
 *
 * Two screens now take a username — the first-login gate (SetUsername) and the
 * profile editor (UserProfile) — and they must agree, because the backend
 * enforces uniqueness but not shape: a name one screen rejects and the other
 * accepts is a difference the user experiences as the app contradicting
 * itself.
 */
export const USERNAME_HINT =
  "3–24 characters; letters, numbers, dots, dashes and underscores.";

/** `null` when the trimmed name is acceptable, otherwise why it isn't. */
export function usernameProblem(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < 3) return "That's too short — 3 characters at least.";
  if (trimmed.length > 24) return "That's too long — 24 characters at most.";
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return "Letters, numbers, dots, dashes and underscores only.";
  }
  return null;
}
