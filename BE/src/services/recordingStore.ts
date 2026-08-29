import { randomUUID } from "node:crypto";

interface StoredRecording {
  id: string;
  data: Buffer;
  createdAt: Date;
}

/**
 * In-memory stand-in for IMPLEMENTATION_PLAN.md §6.2's Prisma `Recording`
 * model (gzipped bytes in a `bytea` column). This lets the frontend prove
 * out cross-client replay (upload from one client, fetch+replay from
 * another) without requiring a live Postgres/Supabase project to be
 * configured in this environment. Swap for the real Prisma model — same
 * gzipped-bytes-in, gzipped-bytes-out contract — once §6 lands for real.
 * Not persisted across server restarts, and unbounded (fine for a demo).
 */
const store = new Map<string, StoredRecording>();

export function saveRecording(data: Buffer): string {
  const id = randomUUID();
  store.set(id, { id, data, createdAt: new Date() });
  return id;
}

export function getRecording(id: string): StoredRecording | undefined {
  return store.get(id);
}
