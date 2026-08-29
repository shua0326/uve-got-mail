import { useCallback, useEffect, useState } from "react";
import { fetchInbox, markMailRead, type MailListItem } from "../api";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

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
          toast.add({
            type: "error",
            title: "Couldn't mark that letter read",
            description: err instanceof Error ? err.message : String(err),
          });
        });
      }
      onView(letter);
    },
    [onView],
  );

  if (status === "loading") {
    return <div className="centered-status">Loading your mail…</div>;
  }

  if (status === "error") {
    return (
      <div className="centered-status">
        <p>Couldn't load your mail.</p>
        <p className="inbox-error-detail">{error}</p>
      </div>
    );
  }

  if (count === 0 || !current) {
    return (
      <div className="centered-status">
        <p>Nothing delivered yet.</p>
        <p className="inbox-empty-hint">
          Letters arrive together at your scheduled delivery time.
        </p>
      </div>
    );
  }

  return (
    <div className="inbox-gallery">
      <Button
        variant="outline"
        size="icon-lg"
        aria-label="Previous letter"
        disabled={index === 0}
        onClick={() => step(-1)}
      >
        ‹
      </Button>

      <article className="inbox-letter-card">
        <header className="inbox-letter-head">
          <span className="inbox-sender-name">
            {current.sender?.username || current.sender?.email || current.senderId}
          </span>
          {!current.read && <span className="inbox-unread-badge">New</span>}
        </header>

        <time className="inbox-letter-date" dateTime={current.sentAt}>
          {formatSentAt(current.sentAt)}
        </time>

        <Button size="lg" onClick={() => open(current)}>
          {current.read ? "Read again" : "Open letter"}
        </Button>

        <p className="inbox-letter-position">
          Letter {index + 1} of {count}
        </p>
      </article>

      <Button
        variant="outline"
        size="icon-lg"
        aria-label="Next letter"
        disabled={index >= count - 1}
        onClick={() => step(1)}
      >
        ›
      </Button>
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
