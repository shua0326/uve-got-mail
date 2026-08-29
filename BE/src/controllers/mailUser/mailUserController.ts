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