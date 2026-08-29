import { useState } from "react";
import { sendFriendRequest } from "../api";
import { Button } from "./pouf/Button";
import { Dialog } from "./pouf/controls";
import { Field, Input } from "./pouf/Input";
import { Stack } from "./pouf/layout";
import { toast } from "./pouf/toaster";

/**
 * The "Add friend" modal: type a username, submit, and get a toast saying
 * whether the request went out. The username lookup and the send are one
 * backend call — `POST /friends/send/:username` 404s when no such user exists
 * — so there's nothing to check before submitting.
 *
 * It owns its own `open` state and renders its own trigger. Pouf's `Dialog`
 * requires a `trigger` (DESIGN_MIGRATION_PLAN.md §4.2), and the honest way to
 * satisfy that is for the button and the dialog to be the same component
 * rather than a hidden placeholder standing in for a button that lives in
 * another file. The caller just drops <AddFriendDialog /> where the button
 * should appear.
 */
export default function AddFriendDialog() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);

  // Clear on the way out (backdrop, Esc, close button, or a successful send)
  // so the next visit starts from an empty box rather than the last attempt.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setUsername("");
      setSending(false);
    }
    setOpen(next);
  }

  async function submit() {
    const trimmed = username.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      await sendFriendRequest(trimmed);
      toast.success("Friend request sent", {
        description: `${trimmed} will see it in their Requests tab.`,
      });
      handleOpenChange(false);
    } catch (err) {
      console.error("Failed to send friend request", err);
      toast.error("Couldn't send friend request", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button size="sm" tone="mint">
          Add friend
        </Button>
      }
      title="Add a friend"
      description="Enter their username. If we find them, we'll send the friend request."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Stack gap={4}>
          {/* A real single-line Input, not the rows={2} Textarea this used to
              be — the Enter key no longer has to be suppressed to stop a
              newline the backend would only trim. */}
          <Field label="Username">
            {(id, describedBy) => (
              <Input
                id={id}
                describedBy={describedBy}
                value={username}
                onChange={setUsername}
                placeholder="username"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={sending}
              />
            )}
          </Field>

          <Button
            type="submit"
            block
            tone="purple"
            disabled={username.trim().length === 0}
            loading={sending}
          >
            Send request
          </Button>
        </Stack>
      </form>
    </Dialog>
  );
}
