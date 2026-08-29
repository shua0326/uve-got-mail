import { useEffect, useState } from "react";
import { fetchInbox, type MailListItem } from "../api";
import { MOCK_INBOX } from "../data/mockInbox";

interface SenderRow {
  sender: MailListItem["sender"];
  lastMail: MailListItem;
  unreadCount: number;
}

/** One row per sender, holding only their most recent letter (highest `id` —
 * Mail has no timestamp field to sort by). */
function groupBySender(mail: MailListItem[]): SenderRow[] {
  const bySender = new Map<string, SenderRow>();
  for (const m of mail) {
    const existing = bySender.get(m.sender.id);
    if (!existing || m.id > existing.lastMail.id) {
      bySender.set(m.sender.id, {
        sender: m.sender,
        lastMail: m,
        unreadCount: (existing?.unreadCount ?? 0) + (m.read ? 0 : 1),
      });
    } else {
      existing.unreadCount += m.read ? 0 : 1;
    }
  }
  return [...bySender.values()].sort((a, b) => b.lastMail.id - a.lastMail.id);
}

export default function Inbox({ onView }: { onView: (mail: MailListItem) => void }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [rows, setRows] = useState<SenderRow[]>([]);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchInbox()
      .then((mail) => {
        if (cancelled) return;
        setRows(groupBySender(mail));
        setUsingMock(false);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        // GET /mail/inbox isn't implemented on the backend yet (§14) — fall
        // back to sample data so the UI is still reviewable/demoable.
        console.warn("Falling back to mock inbox data:", err);
        setRows(groupBySender(MOCK_INBOX));
        setUsingMock(true);
        setStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="inbox-page">
      {usingMock && (
        <div className="inbox-mock-banner">
          Backend mail API isn't available yet — showing sample data.
        </div>
      )}

      {status === "loading" && <div className="centered-status">Loading inbox…</div>}

      {status === "ready" && rows.length === 0 && (
        <div className="centered-status">
          <p>No mail yet.</p>
        </div>
      )}

      {status === "ready" && rows.length > 0 && (
        <ul className="inbox-list">
          {rows.map((row) => (
            <li key={row.sender.id} className="inbox-row">
              <span className="inbox-sender-name">{row.sender.username || row.sender.email}</span>
              {row.unreadCount > 0 && <span className="inbox-unread-badge">{row.unreadCount}</span>}
              <button type="button" className="inbox-view-button" onClick={() => onView(row.lastMail)}>
                View last letter
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
