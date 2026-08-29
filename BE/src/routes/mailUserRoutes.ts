import { Router } from "express";
import {
  getMailUser,
  setUsername,
  getMailUserByUsername,
  getFriends,
} from "../controllers/mailUser/mailUserController";
import { requireAuth } from "../middlewares/authMiddleware";

const router = Router();

// Declared before "/:id" — Express matches in order, so "by-username" and
// "me" would otherwise be swallowed as user ids.
router.get("/by-username/:username", getMailUserByUsername);
router.get("/me/friends", requireAuth, getFriends);

router.get("/:id", getMailUser);
router.post("/:id/username", setUsername);

export default router;
