import { Request, Response } from "express";
import { getRecording, saveRecording } from "../../services/recordingStore";

// IMPLEMENTATION_PLAN.md §6.3: not auth-gated yet — there's no sender/recipient
// mail model wired up in this pass, just a bare upload-by-id/fetch-by-id
// resource to prove cross-client replay works. Gate behind requireAuth once
// this becomes a real mail attachment (§6.3's authorisation rule: an
// undelivered letter's recording must 404 for anyone but the sender).
export function uploadRecording(req: Request, res: Response): void {
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    res.status(400).json({ error: "Expected a non-empty application/octet-stream body" });
    return;
  }

  const id = saveRecording(body);
  res.status(201).json({ id });
}

export function downloadRecording(req: Request, res: Response): void {
  const id = req.params.id;
  const record = typeof id === "string" ? getRecording(id) : undefined;
  if (!record) {
    res.status(404).json({ error: "Recording not found" });
    return;
  }

  // NOT `Content-Encoding: gzip` — that's an HTTP transport-compression hint
  // that browsers transparently auto-decompress before JS ever sees the
  // body, which silently unwraps our application-level gzip (the client's
  // decode() then fails trying to gunzip already-plain JSON). The gzipped
  // bytes are the payload itself, opaque to HTTP, decoded by the client.
  res.setHeader("Content-Type", "application/octet-stream");
  res.send(record.data);
}
