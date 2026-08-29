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
      // Nested connects rather than bare scalar ids: Prisma treats a `data`
      // block as either all-scalar ("unchecked") or all-relational, and the
      // History below has to be a nested write, so every relation here has to
      // match that form.
      recipient: { connect: { id: recipientId } },
      sender: { connect: { id: senderId } },
      recording: { connect: { id: recordingId } },
      // checkMailHistory derives this id but doesn't persist it — a History
      // row only exists once a pair have exchanged a letter. Creating it
      // inline keeps the History and the Mail in one statement; passing a
      // bare historyId for a row that doesn't exist yet is a foreign-key
      // violation, which is why the first letter between any two users failed.
      history: {
        connectOrCreate: {
          where: { id: history.id },
          create: { id: history.id },
        },
      },
    },
  });

  // mailNumber counts the letters that existed *before* this one, so zero is
  // the first letter between the pair — that's when they become friends.
  if (history.mailNumber === 0) {
    await addFriend(senderId, recipientId);
  }
  
  res.status(200).json({ id: mail.id });
  } catch (error) {
    // Logged, not swallowed. This catch used to return a bare 500 and discard
    // `error`, which made a failing send undiagnosable: the client saw
    // "Sending the letter failed (500)" and the server log said nothing at
    // all. A send is the one write in this app the user cannot retry from
    // memory — the recording only exists in the browser tab that drew it — so
    // losing the reason is expensive.
    console.error("[mail] sendMail failed:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getMail(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.dbUser?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // `:id` is the Recording id, and Mail.recordingId is unique, so the mail
    // this recording belongs to is what decides who may read the bytes.
    const id = typeof req.params.id === "string" ? req.params.id : undefined;
    const mail = id ? await prisma.mail.findUnique({ where: { recordingId: id } }) : null;

    // The caller must be the sender, or the recipient of a letter in their
    // current delivery window. A recipient asking before delivery gets the
    // same 404 as a stranger — telling them
    // the letter exists would leak that mail is in flight, which is exactly
    // what the scheduled-delivery model is meant to hide. `archived` is
    // excluded too: a retired letter is gone for good, so a saved link to one
    // stops working rather than outliving its window. An orphan recording
    // with no mail row (a `sendMail` that failed after `saveRecording`) is
    // nobody's, so it falls through to the same 404.
    const authorised = !!mail && (
      mail.senderId === userId ||
      (mail.recipientId === userId && mail.received && !mail.archived)
    );
    if (!mail || !authorised) {
      res.status(404).json({ error: "Recording not found" });
      return;
    }

    const record = await getRecording(mail.recordingId);
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
