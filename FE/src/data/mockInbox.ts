import type { MailListItem } from "../api";
import { SAMPLE_RECORDING_ID } from "./sampleRecording";

// Placeholder rows shown only when GET /mail/inbox is unreachable (the route
// doesn't exist on the backend yet — see IMPLEMENTATION_PLAN.md §14). Lets
// the inbox UI be reviewed/demoed today; it's swapped for real data
// automatically the moment that route starts responding.
//
// `content` points at the bundled SAMPLE_RECORDING_ID fixture rather than a
// fake id — a fake id always 404s against /recordings, which used to make
// "View last letter" unusable even in the mock/demo path (§14).
export const MOCK_INBOX: MailListItem[] = [
  {
    id: 1,
    content: SAMPLE_RECORDING_ID,
    read: false,
    received: true,
    sender: { id: "mock-alice", username: "alice", email: "alice@example.com" },
  },
  {
    id: 2,
    content: SAMPLE_RECORDING_ID,
    read: true,
    received: true,
    sender: { id: "mock-bob", username: "bob", email: "bob@example.com" },
  },
  {
    id: 5,
    content: SAMPLE_RECORDING_ID,
    read: false,
    received: true,
    sender: { id: "mock-alice", username: "alice", email: "alice@example.com" },
  },
];
