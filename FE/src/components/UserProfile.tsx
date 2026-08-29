import { useState } from "react";
import { updateUsername, UsernameTakenError, type AuthUser } from "../api";
import { USERNAME_HINT, usernameProblem } from "../lib/username";
import { Button } from "./pouf/Button";
import { Avatar } from "./pouf/avatar";
import { Field, Input } from "./pouf/Input";
import { Row, Stack } from "./pouf/layout";
import { Separator } from "./pouf/separator";
import { Card } from "./pouf/surface";
import { Heading, Text } from "./pouf/text";
import { toast } from "./pouf/toaster";

/**
 * The signed-in user's own page: who they are, and the one thing about
 * themselves they can change.
 *
 * The avatar is a **placeholder only** — initials on a pouf cushion. There is
 * no avatar upload on the backend (no storage bucket, no column), so offering
 * a control that couldn't persist anything would be a lie; it renders from the
 * username and changes when the username does.
 *
 * Renaming reuses `POST /user/:id/username` — the same call the first-login
 * gate makes — so uniqueness (409 → `UsernameTakenError`) is enforced in one
 * place. The updated user is lifted back to App.tsx via `onUpdated` so the
 * rest of the app sees the new name without a reload.
 */
export default function UserProfile({
  user,
  onUpdated,
}: {
  user: AuthUser;
  onUpdated: (updated: AuthUser) => void;
}) {
  const [username, setUsername] = useState(user.username);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = username.trim();
  const problem = usernameProblem(username);
  const unchanged = trimmed === user.username;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (problem || unchanged || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateUsername(user.id, trimmed);
      onUpdated(updated);
      setUsername(updated.username);
      toast.success("Username updated", {
        description: `You're ${updated.username} from now on.`,
      });
    } catch (err) {
      console.error("Failed to update username", err);
      setError(
        err instanceof UsernameTakenError
          ? err.message
          : `Couldn't save that username (${String(err)}).`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stage-center">
      <Card>
        <Stack gap={5}>
          <Row gap={4} align="center">
            <Avatar size="lg" tone="purple" fallback={user.username} />
            <Stack gap={1}>
              <Heading level={2}>{user.username}</Heading>
              <Text size="sm" muted truncate>
                {user.email}
              </Text>
            </Stack>
          </Row>

          <Separator />

          <form onSubmit={handleSubmit}>
            <Stack gap={4}>
              <Field
                label="Username"
                hint={USERNAME_HINT}
                error={error ?? (problem && username.length > 0 ? problem : undefined)}
              >
                {(id, describedBy) => (
                  <Input
                    id={id}
                    describedBy={describedBy}
                    value={username}
                    onChange={(next) => {
                      setUsername(next);
                      // A stale "already taken" under a name they've since
                      // edited reads as a rejection of the new one.
                      setError(null);
                    }}
                    placeholder="username"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    invalid={Boolean(error) || (username.length > 0 && Boolean(problem))}
                    disabled={saving}
                  />
                )}
              </Field>

              <Button
                type="submit"
                tone="purple"
                block
                disabled={Boolean(problem) || unchanged}
                loading={saving}
              >
                {unchanged ? "Saved" : "Save username"}
              </Button>
            </Stack>
          </form>
        </Stack>
      </Card>
    </div>
  );
}
