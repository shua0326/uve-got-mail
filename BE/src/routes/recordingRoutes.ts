import express, { Router } from "express";
import { downloadRecording, uploadRecording } from "../controllers/recording/recordingController";

const router = Router();

// IMPLEMENTATION_PLAN.md §6.1: raw body parser scoped to this route only —
// gzipped recordings are binary, not JSON, and can exceed the default 100KB
// express.json() limit.
router.post("/", express.raw({ type: "application/octet-stream", limit: "25mb" }), uploadRecording);
router.get("/:id", downloadRecording);

export default router;
