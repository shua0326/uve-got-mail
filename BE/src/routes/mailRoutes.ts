import express, { Router } from "express";
import { getNewMail, getMail, sendMail, markMailRead } from "../controllers/mail/mailController";

const router = Router();

// IMPLEMENTATION_PLAN.md §6.1: raw body parser scoped to this route only —
// gzipped recordings are binary, not JSON, and can exceed the default 100KB
// express.json() limit.
router.post("/:recipientId", express.raw({ type: "application/octet-stream", limit: "25mb" }), sendMail);
router.get("/:id", getMail);
router.put("/:id/read", markMailRead);
router.get("/", getNewMail);

export default router;
