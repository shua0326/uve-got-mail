import { Request, Response } from 'express';
import prisma from "../../database/prisma";
import { addFriend } from '../../utils/mailUserUtils';

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
        const updatedMailUser = await prisma.mailUser.update({
            where: { id: req.params.id },
            data: { username },
        });
        res.status(200).json(updatedMailUser);
    } catch (error) {
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
