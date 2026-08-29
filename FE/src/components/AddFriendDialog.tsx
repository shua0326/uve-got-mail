import { useState } from "react";
import { sendFriendRequest } from "../api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

/**
 * The "Add" modal: type a username, submit, and get a toast saying whether
 * the request went out. The username lookup and the send are one backend
 * call — `POST /friends/send/:username` 404s when no such user exists — so
 * there's nothing to check before submitting.
 */
export default function AddFriendDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);

  // Clear on the way out (backdrop, Esc, close button, or a successful send)
  // so the next visit starts from an empty box rather than the last attempt.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setUsername("");
      setSending(false);
    }
    onOpenChange(next);
  }

  async function submit() {
    const trimmed = username.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      await sendFriendRequest(trimmed);
      toast.add({
        type: "success",
        title: "Friend request sent",
        description: `${trimmed} will see it in their Requests tab.`,
      });
      handleOpenChange(false);
    } catch (err) {
      console.error("Failed to send friend request", err);
      toast.add({
        type: "error",
        title: "Couldn't send friend request",
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
          <DialogTitle>Add a friend</DialogTitle>
          <DialogDescription>
            Enter their username. If we find them, we'll send the friend request.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Textarea
            autoFocus
            rows={2}
            value={username}
            placeholder="username"
            disabled={sending}
            onChange={(e) => setUsername(e.target.value)}
            // A username is a single line — Enter submits rather than
            // inserting a newline the backend would only have to trim.
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <DialogFooter>
            <Button type="submit" disabled={sending || username.trim().length === 0}>
              {sending ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
