import { useEffect, useState } from "react";
import { fetchFriends, findUserByUsername, sendLetter, type MailUserSummary } from "../api";
import { Button } from "./pouf/Button";
import { Dialog } from "./pouf/controls";
import { ErrorNote } from "./pouf/feedback";
import { Field, Input } from "./pouf/Input";
import { Stack } from "./pouf/layout";
import { Separator } from "./pouf/separator";
import { Eyebrow } from "./pouf/text";
import { toast } from "./pouf/toaster";

/**
 * Picks who a finished letter goes to, then posts it.
 *
 * `POST /mail/:recipientId` needs a MailUser id, which the UI never holds —
 * hence two ways in: a friend from `GET /user/me/friends` (already an id), or
 * a typed username resolved through `GET /user/by-username/:username`.
 * Writing to a stranger is supported on purpose: `sendMail` befriends the
 * pair on their first letter.
 *
 * Owns its `open` state and renders its own trigger, for the reason given in
 * AddFriendDialog: pouf's `Dialog` requires a real `trigger` element
 * (DESIGN_MIGRATION_PLAN.md §4.2). The caller renders this where the "send"
 * button belongs — which is only ever while a draft exists.
 */
export default function SendLetterDialog({
  letter,
  onSent,
}: {
  /** The gzipped recording to send, or null while one is still being encoded. */
  letter: Blob | null;
  onSent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<MailUserSummary[]>([]);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetchFriends(controller.signal)
      .then((rows) => {
        setFriends(rows);
        setFriendsError(null);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to load friends", err);
        // Not fatal — the username field still works without the picker.
        setFriendsError(err instanceof Error ? err.message : String(err));
      });
    return () => controller.abort();
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setUsername("");
      setSending(false);
    }
    setOpen(next);
  }

  async function send(recipient: MailUserSummary) {
    if (!letter || sending) return;
    setSending(true);
    try {
      await sendLetter(recipient.id, letter);
      toast.success("Letter sent", {
        description: `It'll reach ${recipient.username || recipient.email} at their next delivery.`,
      });
      handleOpenChange(false);
      onSent();
    } catch (err) {
      console.error("Failed to send letter", err);
      toast.error("Couldn't send that letter", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSending(false);
    }
  }

  async function sendToUsername() {
    const trimmed = username.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const recipient = await findUserByUsername(trimmed);
      if (!recipient) {
        toast.error("No such user", {
          description: `Nobody is using the username "${trimmed}".`,
        });
        return;
      }
      setSending(false);
      await send(recipient);
    } catch (err) {
      console.error("Failed to look that username up", err);
      toast.error("Couldn't send that letter", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSending(false);
    }
  }

  const hasFriends = friends.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button size="sm" tone="mint">
          Send this letter…
        </Button>
      }
      title="Send your letter"
      description="It won't arrive straight away — letters are delivered together at a random time each day."
    >
      <Stack gap={4}>
        {hasFriends && (
          <>
            <Eyebrow>Your friends</Eyebrow>
            <Stack gap={2}>
              {friends.map((friend) => (
                <Button
                  key={friend.id}
                  variant="quiet"
                  block
                  disabled={sending || !letter}
                  onClick={() => void send(friend)}
                >
                  {friend.username || friend.email}
                </Button>
              ))}
            </Stack>
            <Separator />
          </>
        )}

        {friendsError && (
          <ErrorNote>Couldn't load your friends — send by username instead.</ErrorNote>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendToUsername();
          }}
        >
          <Stack gap={4}>
            {/* The label carries the "or" that the old placeholder tried to,
                which read as a dangling conjunction whenever the friends list
                above it was empty. */}
            <Field
              label={hasFriends ? "Or send to a username" : "Send to a username"}
              hint="Writing to someone new? Sending the letter makes you friends."
            >
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
              disabled={!letter || username.trim().length === 0}
              loading={sending}
            >
              Send
            </Button>
          </Stack>
        </form>
      </Stack>
    </Dialog>
  );
}
