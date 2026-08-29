import { Router } from "express";
import { requireDeliverySecret, runDelivery } from "../controllers/delivery/deliveryController";

const router = Router();

// Deliberately not under /mail: that router is behind requireAuth (a user
// token), while this runs as the system, and `POST /mail/:recipientId` would
// otherwise swallow the path as a recipient id.
router.post("/run", requireDeliverySecret, runDelivery);

export default router;
