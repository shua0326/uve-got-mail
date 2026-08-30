import { Request, Response } from 'express';
import prisma from "../../database/prisma";


export async function getFriendRequests(req: Request, res: Response) {

    const id = req.dbUser?.id
    if (!id) return res.status(401).json({ message: 'Unauthorized' });

    const friendRequests = await prisma.friendRequest.findMany({
        where: { recipientId: id },
        include: { sender: { select: { id: true, username: true, email: true } } },
    });
    res.json(friendRequests);
}

export async function sendFriendRequest(req: Request, res: Response) {
    try {
        const username = req.params.username;
        const id = req.dbUser?.id;

        if (!id) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        if (!username || typeof username !== 'string') {
            res.status(400).json({ message: "Recipient username is required" });
            return;
        }

        const recipient = await prisma.mailUser.findUnique({
            where: { username },
        });

        if (!recipient) {
            res.status(404).json({ message: "Recipient not found" });
            return;
        }

        if (recipient.id === id) {
            res.status(400).json({ message: "Cannot send a friend request to yourself" });
            return;
        }

        // Friendship is stored on one side only — `acceptFriendRequest`
        // connects the requester's `friends`, which leaves the other user
        // holding the pair in `friendOf`. Either side counts, so both are
        // checked or the answer depends on who happened to send first.
        const alreadyFriends = await prisma.mailUser.findFirst({
            where: {
                id,
                OR: [
                    { friends: { some: { id: recipient.id } } },
                    { friendOf: { some: { id: recipient.id } } },
                ],
            },
            select: { id: true },
        });

        if (alreadyFriends) {
            res.status(400).json({ message: `You are already friends with ${recipient.username}` });
            return;
        }

        const existing = await prisma.friendRequest.findUnique({
            where: { senderId_recipientId: { senderId: id, recipientId: recipient.id } },
        });

        if (existing) {
            res.status(400).json({ message: "Friend request already exists" });
            return;
        }

        // The other direction: they asked first and it is still pending.
        // Sending back is the same intent as accepting, so it accepts —
        // otherwise two people who both reach for "Add friend" end up with a
        // pair of mirrored requests and neither is friends with the other.
        const reciprocal = await prisma.friendRequest.findUnique({
            where: { senderId_recipientId: { senderId: recipient.id, recipientId: id } },
        });

        if (reciprocal) {
            // One transaction: connecting the friendship and retiring the
            // request it came from have to land together, or a failure
            // between them leaves a pending request between two people who
            // are already friends.
            await prisma.$transaction([
                prisma.mailUser.update({
                    where: { id: reciprocal.senderId },
                    data: { friends: { connect: { id: reciprocal.recipientId } } },
                }),
                prisma.friendRequest.delete({ where: { id: reciprocal.id } }),
            ]);

            res.status(200).json({ friended: true, friend: { id: recipient.id, username: recipient.username } });
            return;
        }

        const request = await prisma.friendRequest.create({
            data: {
                senderId: id,
                recipientId: recipient.id,
            },
        });

        res.status(201).json(request);
    } catch (error) {
        // Two sends racing past the `existing` check both reach the create and
        // the unique index rejects the second. That is the same outcome the
        // check ahead of it reports, not a server fault, so it answers the
        // same way rather than surfacing a 500 the user can do nothing with.
        if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
            res.status(400).json({ message: "Friend request already exists" });
            return;
        }
        console.error("[friends] sendFriendRequest failed:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function acceptFriendRequest(req: Request, res: Response) {
    try {
        if (!req.params.id || typeof req.params.id !== 'string') {
            res.status(400).json({ message: "Mail user id is required" });
            return;
        }

        const request = await prisma.friendRequest.findUnique({
            where: { id: req.params.id },
        });

        if (!request) {
            res.status(404).json({ message: "Friend request not found" });
            return;
        }

        // `sendFriendRequest` refuses self-requests, so this only fires for a
        // row that predates that guard. Accepting it would connect a user to
        // themselves in `friends`, which nothing downstream expects, so the
        // stale row is retired instead of acted on.
        if (request.senderId === request.recipientId) {
            await prisma.friendRequest.delete({ where: { id: request.id } });
            res.status(400).json({ message: "You cannot be friends with yourself" });
            return;
        }

        const updatedMailUser = await prisma.mailUser.update({
            where: { id: request.senderId },
            data: { friends: { connect: { id: request.recipientId } } },
        });
        await prisma.friendRequest.delete({
            where: { id: req.params.id },
        });
        res.status(200).json(updatedMailUser);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function declineFriendRequest(req: Request, res: Response) {
    try {
        if (!req.params.id || typeof req.params.id !== 'string') {
            res.status(400).json({ message: "Friend request id is required" });
            return;
        }

        await prisma.friendRequest.delete({
            where: { id: req.params.id },
        });
        res.status(200).json({ message: "Friend request declined" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}

