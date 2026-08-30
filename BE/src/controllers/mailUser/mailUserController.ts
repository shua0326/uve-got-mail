import { Request, Response } from 'express';
import prisma from "../../database/prisma";
import { addFriend } from '../../utils/mailUserUtils';
import { usernameProblem } from '../../utils/usernameUtils';

export async function getMailUser(req: Request, res: Response) {
    try {
        if (!req.params.id || typeof req.params.id !== 'string') {
            res.status(400).json({ message: "Mail user ID is required" });
            return;
        }
        const mailUser = await prisma.mailUser.findUnique({
            where: { id: req.params.id },
        });
        if (!mailUser) {
            res.status(404).json({ message: "Mail user not found" });
            return;
        }
        res.status(200).json(mailUser);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function setUsername(req: Request, res: Response) {
    try {
        if (!req.params.id || typeof req.params.id !== 'string') {
            res.status(400).json({ message: "Mail user ID is required" });
            return;
        }
        const { username } = req.body;
        if (!username || typeof username !== 'string') {
            res.status(400).json({ message: "Username is required" });
            return;
        }

        // Trimmed before validating *and* before storing. Both FE screens
        // already trim, but a name saved with an edge space would be a
        // different string from the one `GET /user/by-username/:username`
        // matches, so its owner could not be found by the name they think
        // they have.
        const trimmed = username.trim();
        const problem = usernameProblem(trimmed);
        if (problem) {
            res.status(400).json({ message: problem });
            return;
        }

        const updatedMailUser = await prisma.mailUser.update({
            where: { id: req.params.id },
            data: { username: trimmed },
        });
        res.status(200).json(updatedMailUser);
    } catch (error) {
        // `username` is unique in the schema, so a name someone else already
        // holds arrives here as P2002. The FE has always expected 409 for it
        // (`UsernameTakenError` in FE/src/api.ts) — answering with the generic
        // 500 left that branch unreachable and showed "Couldn't save username
        // (500)" for the one failure the user can actually do something about.
        const code = (error as { code?: string }).code;
        if (code === 'P2002') {
            res.status(409).json({ message: "That username is already taken" });
            return;
        }
        // P2025: `update` found no MailUser with that id.
        if (code === 'P2025') {
            res.status(404).json({ message: "Mail user not found" });
            return;
        }
        console.error("[user] setUsername failed:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

/** Resolves a username to the id `POST /mail/:recipientId` needs. Only the
 * public-facing fields are returned — this is a lookup by a name someone
 * typed, not a profile endpoint. */
export async function getMailUserByUsername(req: Request, res: Response) {
    try {
        const username = req.params.username;
        if (!username || typeof username !== 'string') {
            res.status(400).json({ message: "Username is required" });
            return;
        }
        const mailUser = await prisma.mailUser.findUnique({
            where: { username },
            select: { id: true, username: true, email: true },
        });
        if (!mailUser) {
            res.status(404).json({ message: "Mail user not found" });
            return;
        }
        res.status(200).json(mailUser);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * The signed-in user's friends.
 *
 * `friends`/`friendOf` are the two sides of the same self-relation, and
 * `acceptFriendRequest` only ever connects one direction, so a complete list
 * is the union of both — deduplicated, since a mutual connection appears in
 * each.
 */
export async function getFriends(req: Request, res: Response) {
    try {
        const userId = req.dbUser?.id;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const summary = { id: true, username: true, email: true };
        const user = await prisma.mailUser.findUnique({
            where: { id: userId },
            select: {
                friends: { select: summary },
                friendOf: { select: summary },
            },
        });

        if (!user) {
            res.status(404).json({ message: "Mail user not found" });
            return;
        }

        const byId = new Map<string, { id: string; username: string; email: string }>();
        for (const friend of [...user.friends, ...user.friendOf]) byId.set(friend.id, friend);
        res.status(200).json([...byId.values()]);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}
