import { useState } from "react";
import { updateUsername, UsernameTakenError, type AuthUser } from "../api";
import { USERNAME_HINT, usernameProblem } from "../lib/username";
import { Button } from "./pouf/Button";
import { Field, Input } from "./pouf/Input";
import { Stack } from "./pouf/layout";
import { Blob } from "./pouf/media";
import { Card } from "./pouf/surface";
import { Heading, Text } from "./pouf/text";

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
  // the gate re-fire on the next login. `usernameProblem` rejects one on the
  // charset rule, since '@' isn't in the allowed set.
  const problem = usernameProblem(username);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (problem || saving) return;
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
    <div className="page-center">
      <Card>
        <Stack gap={4}>
          <Blob icon="user" tone="mint" size="md" />
          <Heading level={2}>Pick a username</Heading>
          <Text muted size="sm">
            This is how other people will find and address you on uve got mail!
          </Text>

          <form onSubmit={handleSubmit}>
            <Stack gap={4}>
              {/* `Field` owns the label, hint and error copy — the three
                  hand-rolled <p> elements this screen used to carry — and
                  wires `aria-describedby` to whichever of them is showing. */}
              <Field
                label="Username"
                hint={USERNAME_HINT}
                // Only surface the shape rule once they've typed something;
                // an error on an untouched empty field is just nagging.
                error={error ?? (username.length > 0 ? (problem ?? undefined) : undefined)}
              >
                {(id, describedBy) => (
                  <Input
                    id={id}
                    describedBy={describedBy}
                    autoFocus
                    value={username}
                    onChange={setUsername}
                    placeholder="username"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    invalid={Boolean(error) || (username.length > 0 && Boolean(problem))}
                    disabled={saving}
                  />
                )}
              </Field>

              <Button type="submit" block tone="purple" disabled={Boolean(problem)} loading={saving}>
                Continue
              </Button>
            </Stack>
          </form>

          <Button variant="quiet" size="sm" onClick={onSignOut}>
            Sign out
          </Button>
        </Stack>
      </Card>
    </div>
  );
}
