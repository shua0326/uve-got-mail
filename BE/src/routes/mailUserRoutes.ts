import express, { Router } from "express";
import { getMailUser, setUsername } from "../controllers/mailUser/mailUserController";

const router = Router();

router.get("/:id", getMailUser);
router.post("/:id/username", setUsername);

export default router;