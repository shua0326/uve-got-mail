import { useCallback, useEffect, useState } from "react";
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriendRequests,
  type FriendRequestItem,
} from "../api";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/**
 * The friend requests addressed to the signed-in user, laid out as a list
 * mirroring the Inbox page. Backed by `GET /friends`; accepting or declining
 * hits `PUT /friends/:id/accept|decline`, both of which delete the row, so a
 * settled request is dropped from the list rather than re-fetched.
 */
export default function Requests() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Ids currently mid-accept/decline — keeps both buttons on that row
  // disabled so a double-click can't fire two requests against a row the
  // backend has already deleted.
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    fetchFriendRequests(controller.signal)
      .then((rows) => {
        setRequests(rows);
        setStatus("ready");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to load friend requests", err);
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  const settle = useCallback(
    async (request: FriendRequestItem, action: "accept" | "decline") => {
      setPending((prev) => new Set(prev).add(request.id));
      const name = displayName(request);
      try {
        if (action === "accept") await acceptFriendRequest(request.id);
        else await declineFriendRequest(request.id);
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
        toast.add({
          type: "success",
          title: action === "accept" ? "Friend request accepted" : "Friend request declined",
          description:
            action === "accept" ? `You and ${name} are now friends.` : `Declined ${name}'s request.`,
        });
      } catch (err) {
        console.error(`Failed to ${action} friend request`, err);
        toast.add({
          type: "error",
          title: action === "accept" ? "Couldn't accept" : "Couldn't decline",
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(request.id);
          return next;
        });
      }
    },
    [],
  );

  return (
    <div className="inbox-page">
      {status === "loading" && <div className="centered-status">Loading requests…</div>}

      {status === "error" && (
        <div className="centered-status">
          <p>Couldn't load your friend requests.</p>
          <p className="requests-error-detail">{error}</p>
        </div>
      )}

      {status === "ready" && requests.length === 0 && (
        <div className="centered-status">
          <p>No friend requests.</p>
        </div>
      )}

      {status === "ready" && requests.length > 0 && (
        <ul className="inbox-list">
          {requests.map((request) => (
            <li key={request.id} className="inbox-row">
              <span className="inbox-sender-name">{displayName(request)}</span>
              <span className="requests-subtitle">wants to be friends</span>
              <div className="requests-actions">
                <Button
                  size="sm"
                  disabled={pending.has(request.id)}
                  onClick={() => void settle(request, "accept")}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending.has(request.id)}
                  onClick={() => void settle(request, "decline")}
                >
                  Decline
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Accounts that haven't picked a username yet still have `username === email`
 * (BE/src/controllers/auth/authController.ts), so either field is a real name;
 * the sender id is the last resort. */
function displayName(request: FriendRequestItem): string {
  return request.sender?.username || request.sender?.email || request.senderId;
}
