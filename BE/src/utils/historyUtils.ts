import prisma from "../database/prisma";
import type { HistoryQuery } from "../types/history.types";


export async function checkMailHistory(senderId: string, recipientId: string): Promise<HistoryQuery> {
  const historyId = formHistoryId(senderId, recipientId);
  const history = await prisma.history.findUnique({
    where: {
      id: historyId,
    },
    include: {
      mails: true,
    },
  });
  if (!history) return { id: historyId, mailNumber: 0 };
  return { id: historyId, mailNumber: history.mails.length };

}

function formHistoryId(senderId: string, recipientId: string) {
  const firstId = senderId < recipientId ? senderId : recipientId;
  const secondId = senderId < recipientId ? recipientId : senderId;
  return `${firstId}-${secondId}`;
}