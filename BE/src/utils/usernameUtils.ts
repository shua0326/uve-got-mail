/**
 * The username rule, server side.
 *
 * A deliberate mirror of `FE/src/lib/username.ts`. The two have to agree, and
 * the frontend copy cannot stand alone: `POST /user/:id/username` is a plain
 * HTTP endpoint, so a rule enforced only in the browser is not enforced at
 * all. Change one, change the other.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

/** `null` when the trimmed name is acceptable, otherwise why it isn't. */
export function usernameProblem(raw: string): string | null {
    const trimmed = raw.trim();
    if (trimmed.length < USERNAME_MIN) {
        return `That's too short — ${USERNAME_MIN} characters at least.`;
    }
    if (trimmed.length > USERNAME_MAX) {
        return `That's too long — ${USERNAME_MAX} characters at most.`;
    }
    if (!USERNAME_PATTERN.test(trimmed)) {
        return "Letters, numbers, dots, dashes and underscores only.";
    }
    return null;
}
