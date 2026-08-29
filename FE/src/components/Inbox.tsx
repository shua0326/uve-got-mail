import { useCallback, useEffect, useState } from "react";
import { fetchInbox, markMailRead, type MailListItem } from "../api";
import { Button, IconButton } from "./pouf/Button";
import { Empty, ErrorNote, Skeleton } from "./pouf/feedback";
import { Icon } from "./pouf/Icon";
import { Row, Stack } from "./pouf/layout";
import { Badge } from "./pouf/media";
import { Card } from "./pouf/surface";
import { Heading, Text } from "./pouf/text";
import { toast } from "./pouf/toaster";

/**
 * One letter at a time, navigable like a gallery.
 *
 * `GET /mail` returns the caller's current delivery window — every letter the
 * scheduled-delivery service has marked `received` — oldest first. The whole
 * window stays re-readable until the next delivery replaces it, so reading a
 * letter doesn't remove it here; it only clears the unread badge.
 */
export default function Inbox({ onView }: { onView: (mail: MailListItem) => void }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [mail, setMail] = useState<MailListItem[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchInbox(controller.signal)
      .then((rows) => {
        setMail(rows);
        setIndex(0);
        setStatus("ready");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to load inbox", err);
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  const count = mail.length;
  const current = mail[index];

  const step = useCallback(
    (delta: number) => {
      setIndex((i) => Math.min(Math.max(i + delta, 0), Math.max(count - 1, 0)));
    },
    [count],
  );

  // Arrow keys move through the window as well as the buttons — the letter is
  // the only thing on this page, so there's nothing else the keys would mean.
  useEffect(() => {
    if (status !== "ready" || count === 0) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, count, step]);

  const open = useCallback(
    (letter: MailListItem) => {
      // Marked read on open rather than on playback finishing, so a letter
      // that's closed early still counts as read. Optimistic: the letter
      // stays in the window either way, so a failed write costs only a stale
      // badge until the next fetch.
      if (!letter.read) {
        setMail((prev) => prev.map((m) => (m.id === letter.id ? { ...m, read: true } : m)));
        markMailRead(letter.id).catch((err) => {
          console.error("Failed to mark mail read", err);
          setMail((prev) => prev.map((m) => (m.id === letter.id ? { ...m, read: false } : m)));
          toast.error("Couldn't mark that letter read", {
            description: err instanceof Error ? err.message : String(err),
          });
        });
      }
      onView(letter);
    },
    [onView],
  );

  if (status === "loading") {
    return (
      <div className="stage-center">
        <div className="letter-card">
          <Skeleton variant="card" />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="stage-center">
        <Stack gap={3}>
          <Text>Couldn't load your mail.</Text>
          <ErrorNote>{error}</ErrorNote>
        </Stack>
      </div>
    );
  }

  if (count === 0 || !current) {
    return (
      <div className="stage-center">
        <Empty icon="mail" title="Nothing delivered yet.">
          Letters arrive together at your scheduled delivery time.
        </Empty>
      </div>
    );
  }

  return (
    <div className="stage-center">
      <Row gap={5} justify="center" align="center" wrap={false}>
        <IconButton
          icon={<Icon name="prev" />}
          label="Previous letter"
          variant="quiet"
          size="lg"
          disabled={index === 0}
          onClick={() => step(-1)}
        />

        <div className="letter-card">
          <Card motion="lift">
            <Stack gap={4}>
              <Row gap={3} justify="between" align="center">
                <Heading level={3}>
                  {current.sender?.username || current.sender?.email || current.senderId}
                </Heading>
                {!current.read && <Badge tone="purple">New</Badge>}
              </Row>

              <Text size="sm" muted>
                {formatSentAt(current.sentAt)}
              </Text>

              <Button size="lg" block tone="purple" onClick={() => open(current)}>
                {current.read ? "Read again" : "Open letter"}
              </Button>

              <Text size="sm" muted num>
                Letter {index + 1} of {count}
              </Text>
            </Stack>
          </Card>
        </div>

        <IconButton
          icon={<Icon name="next" />}
          label="Next letter"
          variant="quiet"
          size="lg"
          disabled={index >= count - 1}
          onClick={() => step(1)}
        />
      </Row>
    </div>
  );
}

/** `sentAt` arrives as an ISO string over JSON, not a Date. */
function formatSentAt(sentAt: string): string {
  const date = new Date(sentAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
