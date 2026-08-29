import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { deliverDueMail } from "../../services/deliveryService";

/**
 * Guards the manual delivery trigger with a shared secret from
 * `DELIVERY_SECRET`. The endpoint is disabled outright when that isn't set,
 * so an unconfigured deployment can't have its delivery schedule driven by
 * anyone who finds the route.
 */
export function requireDeliverySecret(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.DELIVERY_SECRET;
  if (!expected) {
    res.status(503).json({ error: "Manual delivery is disabled (DELIVERY_SECRET is not set)" });
    return;
  }

  const provided = req.get("x-delivery-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, so check that separately.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Invalid delivery secret" });
    return;
  }

  next();
}

/** Runs a delivery pass immediately, for testing and for catching up after
 * downtime. The scheduled job (server.ts) calls the same service function. */
export async function runDelivery(req: Request, res: Response): Promise<void> {
  try {
    const report = await deliverDueMail();
    res.status(200).json(report);
  } catch (error) {
    console.error("Manual delivery failed:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
