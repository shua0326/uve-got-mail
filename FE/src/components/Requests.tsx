import { useCallback, useEffect, useState } from "react";
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriendRequests,
  type FriendRequestItem,
} from "../api";
import { Button } from "./pouf/Button";
import { Empty, ErrorNote, Skeleton } from "./pouf/feedback";
import { Row, Stack } from "./pouf/layout";
import { Avatar } from "./pouf/avatar";
import { RowCard } from "./pouf/surface";
import { Text } from "./pouf/text";
import { toast } from "./pouf/toaster";

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
        toast.success(
          action === "accept" ? "Friend request accepted" : "Friend request declined",
          {
            description:
              action === "accept"
                ? `You and ${name} are now friends.`
                : `Declined ${name}'s request.`,
          },
        );
      } catch (err) {
        console.error(`Failed to ${action} friend request`, err);
        toast.error(action === "accept" ? "Couldn't accept" : "Couldn't decline", {
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

  if (status === "loading") {
    return (
      <div className="stage-scroll">
        <Skeleton variant="row" count={3} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="stage-center">
        <Stack gap={3}>
          <Text>Couldn't load your friend requests.</Text>
          <ErrorNote>{error}</ErrorNote>
        </Stack>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="stage-center">
        <Empty icon="users" title="No friend requests.">
          When someone adds you by username, they'll show up here.
        </Empty>
      </div>
    );
  }

  return (
    <div className="stage-scroll">
      <Stack gap={3}>
        {requests.map((request) => (
          // No `onClick` on the RowCard: it would render the whole row as a
          // button, and the row itself isn't the target — only its two
          // actions are, and a button inside a button is invalid anyway.
          <RowCard key={request.id}>
            <Row gap={4} justify="between" align="center">
              <Row gap={3} align="center">
                <Avatar size="sm" tone="blue" fallback={displayName(request)} />
                <Stack gap={1}>
                  <Text truncate>{displayName(request)}</Text>
                  <Text size="sm" muted>
                    wants to be friends
                  </Text>
                </Stack>
              </Row>
              <Row gap={2} wrap={false}>
                <Button
                  size="sm"
                  tone="mint"
                  loading={pending.has(request.id)}
                  onClick={() => void settle(request, "accept")}
                >
                  Accept
                </Button>
                {/* Pouf has no `destructive` variant — depth and pastel are
                    the whole vocabulary — so decline is the quiet pink one:
                    reachable, but not competing with Accept's cushion. */}
                <Button
                  size="sm"
                  tone="pink"
                  variant="quiet"
                  disabled={pending.has(request.id)}
                  onClick={() => void settle(request, "decline")}
                >
                  Decline
                </Button>
              </Row>
            </Row>
          </RowCard>
        ))}
      </Stack>
    </div>
  );
}

/** Accounts that haven't picked a username yet still have `username === email`
 * (BE/src/controllers/auth/authController.ts), so either field is a real name;
 * the sender id is the last resort. */
function displayName(request: FriendRequestItem): string {
  return request.sender?.username || request.sender?.email || request.senderId;
}
