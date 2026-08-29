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

        const existing = await prisma.friendRequest.findUnique({
            where: { senderId_recipientId: { senderId: id, recipientId: recipient.id } },
        });

        if (existing) {
            res.status(400).json({ message: "Friend request already exists" });
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

