import { Request, Response } from 'express';
import { getRecording, saveRecording } from "../../utils/recordingUtils";
import { checkMailHistory } from "../../utils/historyUtils";
import { addFriend } from "../../utils/mailUserUtils";
import prisma from "../../database/prisma";

export async function getNewMail(req: Request, res: Response) {
    try {
        const userId = req.dbUser?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        
        // `received` is the delivery window: the scheduled-delivery service
        // flips it on for the batch due at the recipient's `scheduledMail`
        // time. Read mail stays in the list — a delivered letter is
        // re-readable until the next delivery replaces the batch — so this
        // deliberately does NOT filter on `read`.
        const mail = await prisma.mail.findMany({
            where: {
                recipientId: userId,
                received: true,
                archived: false
            },
            include: { sender: { select: { id: true, username: true, email: true } } },
            orderBy: { sentAt: 'asc' },
        });
        return res.status(200).json(mail);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
        return;
    }
}

export async function sendMail(req: Request, res: Response): Promise<void> {
  try {
    const recipientId = req.params.recipientId;
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: "Expected a non-empty application/octet-stream body" });
        return;
    }

  if (!recipientId || typeof recipientId !== "string") {
    res.status(400).json({ error: "Missing recipientId or body" });
    return;
  }

  const recordingId = await saveRecording(body);
  const senderId = req.dbUser?.id;
  if (!senderId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const history = await checkMailHistory(senderId, recipientId);
  
  const mail = await prisma.mail.create({
    data: {
      recipientId: recipientId,
      recordingId: recordingId,
      senderId: senderId,
      historyId: history.id,
    },
  });

  if (history.mailNumber == 1) {
    await addFriend(senderId, recipientId);
  }
  
  res.status(200).json({ id: mail.id });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getMail(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id;
    const record = typeof id === "string" ? await getRecording(id) : undefined;
    if (!record) {
      res.status(404).json({ error: "Recording not found" });
      return;
    }
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(record.data);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function markMailRead(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.dbUser?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Mail.id is an autoincrementing Int, not a uuid like the other routes.
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Mail id must be an integer" });
      return;
    }

    const mail = await prisma.mail.findUnique({ where: { id } });
    if (!mail) {
      res.status(404).json({ error: "Mail not found" });
      return;
    }

    // Only the recipient may mark their own mail read.
    if (mail.recipientId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const updated = await prisma.mail.update({
      where: { id },
      data: { read: true },
    });
    res.status(200).json({ id: updated.id, read: updated.read });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}
