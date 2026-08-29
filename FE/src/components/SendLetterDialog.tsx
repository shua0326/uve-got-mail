import { useEffect, useState } from "react";
import { fetchFriends, findUserByUsername, sendLetter, type MailUserSummary } from "../api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

/**
 * Picks who a finished letter goes to, then posts it.
 *
 * `POST /mail/:recipientId` needs a MailUser id, which the UI never holds —
 * hence two ways in: a friend from `GET /user/me/friends` (already an id), or
 * a typed username resolved through `GET /user/by-username/:username`.
 * Writing to a stranger is supported on purpose: `sendMail` befriends the
 * pair on their first letter.
 */
export default function SendLetterDialog({
  open,
  onOpenChange,
  letter,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The gzipped recording to send, or null while one is still being encoded. */
  letter: Blob | null;
  onSent: () => void;
}) {
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
    onOpenChange(next);
  }

  async function send(recipient: MailUserSummary) {
    if (!letter || sending) return;
    setSending(true);
    try {
      await sendLetter(recipient.id, letter);
      toast.add({
        type: "success",
        title: "Letter sent",
        description: `It'll reach ${recipient.username || recipient.email} at their next delivery.`,
      });
      handleOpenChange(false);
      onSent();
    } catch (err) {
      console.error("Failed to send letter", err);
      toast.add({
        type: "error",
        title: "Couldn't send that letter",
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
        toast.add({
          type: "error",
          title: "No such user",
          description: `Nobody is using the username "${trimmed}".`,
        });
        return;
      }
      setSending(false);
      await send(recipient);
    } catch (err) {
      console.error("Failed to look that username up", err);
      toast.add({
        type: "error",
        title: "Couldn't send that letter",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send your letter</DialogTitle>
          <DialogDescription>
            It won't arrive straight away — letters are delivered together at a random
            time each day.
          </DialogDescription>
        </DialogHeader>

        {friends.length > 0 && (
          <div className="send-letter-friends">
            {friends.map((friend) => (
              <Button
                key={friend.id}
                variant="outline"
                disabled={sending || !letter}
                onClick={() => void send(friend)}
              >
                {friend.username || friend.email}
              </Button>
            ))}
          </div>
        )}

        {friendsError && (
          <p className="send-letter-note">
            Couldn't load your friends — send by username instead.
          </p>
        )}

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void sendToUsername();
          }}
        >
          <Textarea
            rows={2}
            value={username}
            placeholder="or send to a username"
            disabled={sending}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendToUsername();
              }
            }}
          />
          <Button type="submit" disabled={sending || !letter || username.trim().length === 0}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
