import { useEffect, useState } from "react";
import { fetchFriends, findUserByUsername, sendLetter, type MailUserSummary } from "../api";
import { Button } from "./pouf/Button";
import { Dialog } from "./pouf/controls";
import { ErrorNote } from "./pouf/feedback";
import { Field, Input } from "./pouf/Input";
import { Stack } from "./pouf/layout";
import { Separator } from "./pouf/separator";
import { Eyebrow, Heading } from "./pouf/text";
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
 *
 * TWO STEPS, ON PURPOSE
 *
 * Choosing a recipient and sending used to be one click: every name in the
 * friends list was itself the send button. That is the right shape for a chat
 * message and the wrong one for a letter — it makes the most irreversible
 * action in the app the easiest thing on the screen to do by accident, and it
 * never shows you who you picked before it has already gone.
 *
 * So addressing and sending are separated. Step one picks a recipient and
 * does nothing else; step two shows the letter addressed and asks for one
 * deliberate confirmation. Nothing is posted until that second act — and
 * "back" between them costs one click, because changing your mind about who a
 * letter is for is a normal thing to do.
 *
 * Step two briefly carried a wax-seal press-and-hold. It was removed: it
 * never read as sealing anything, and an ornamental gesture in front of the
 * one irreversible action in the app is a cost with no matching benefit. The
 * separation of addressing from sending is the part that was doing the real
 * work, and it stays.
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
  // null = still addressing. Set = addressed, waiting to be sealed.
  const [recipient, setRecipient] = useState<MailUserSummary | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

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
      setRecipient(null);
      setLookupError(null);
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

  /** Resolves a typed username to a real recipient and moves to the seal
   *  step. It no longer sends — the lookup is part of ADDRESSING the letter,
   *  and a 404 here has to be recoverable without losing the draft. */
  async function addressByUsername() {
    const trimmed = username.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setLookupError(null);
    try {
      const found = await findUserByUsername(trimmed);
      if (!found) {
        setLookupError(`Nobody is using the username "${trimmed}".`);
        return;
      }
      setRecipient(found);
    } catch (err) {
      console.error("Failed to look that username up", err);
      setLookupError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  const hasFriends = friends.length > 0;
  const recipientLabel = recipient
    ? recipient.username || recipient.email || "them"
    : "";

  // ---- Step two: addressed, waiting to be sealed. ------------------------
  if (recipient) {
    return (
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        trigger={
          <Button size="sm" tone="mint">
            Send this letter…
          </Button>
        }
        title="Ready to send?"
        description="There's no unsending it — and it won't arrive straight away. Letters are delivered together at a random time each day."
      >
        <Stack gap={5}>
          <Stack gap={1}>
            <Eyebrow>To</Eyebrow>
            <Heading level={3}>{recipientLabel}</Heading>
          </Stack>

          <Button
            block
            size="lg"
            tone="purple"
            disabled={!letter}
            loading={sending}
            onClick={() => void send(recipient)}
          >
            Send it to {recipientLabel}
          </Button>

          <Button
            size="sm"
            variant="quiet"
            block
            disabled={sending}
            onClick={() => setRecipient(null)}
          >
            ← Send it to someone else
          </Button>
        </Stack>
      </Dialog>
    );
  }

  // ---- Step one: who is it for? ------------------------------------------
  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button size="sm" tone="mint">
          Send this letter…
        </Button>
      }
      title="Who's it for?"
      description="Address the letter first. Nothing is sent until you seal it on the next step."
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
                  // Addresses the letter. It does NOT send — see the note at
                  // the top of this file.
                  onClick={() => setRecipient(friend)}
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
            void addressByUsername();
          }}
        >
          <Stack gap={4}>
            {/* The label carries the "or" that the old placeholder tried to,
                which read as a dangling conjunction whenever the friends list
                above it was empty. */}
            <Field
              label={hasFriends ? "Or address it to a username" : "Address it to a username"}
              hint="Writing to someone new? Sending the letter makes you friends."
              // A missing username is a correction to make in place, not a
              // toast that vanishes while you are still reading it.
              error={lookupError ?? undefined}
            >
              {(id, describedBy) => (
                <Input
                  id={id}
                  describedBy={describedBy}
                  value={username}
                  onChange={(next) => {
                    setUsername(next);
                    setLookupError(null);
                  }}
                  placeholder="username"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  invalid={Boolean(lookupError)}
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
              Address it
            </Button>
          </Stack>
        </form>
      </Stack>
    </Dialog>
  );
}
