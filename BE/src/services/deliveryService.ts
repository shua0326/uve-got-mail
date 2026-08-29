import prisma from "../database/prisma";

/**
 * Scheduled mail delivery.
 *
 * Letters don't arrive when they're sent — they accumulate, and the whole
 * batch lands at once at the recipient's `MailUser.scheduledMail` time. That
 * batch stays readable (and re-readable) until the *next* delivery, which
 * archives it and puts the new batch on show. So a `Mail` row moves through:
 *
 *   received:false archived:false   in flight, invisible to the recipient
 *   received:true  archived:false   the current window — what GET /mail returns
 *   received:true  archived:true    retired by a later delivery
 *
 * After delivering, a user's `scheduledMail` rolls forward to a new random
 * time the following day, so nobody knows when their mail is due.
 */

// Deliveries land at a random time inside this window, in the server's local
// timezone. Kept narrow enough that mail arrives at a sociable hour.
const WINDOW_START_HOUR = 8;
const WINDOW_END_HOUR = 20;

export interface DeliveryReport {
  /** Users whose scheduled time had come. */
  users: number;
  /** Letters moved into the new window. */
  delivered: number;
  /** Letters retired from the previous window. */
  archived: number;
}

/**
 * A random instant inside the delivery window on the first day strictly after
 * `after`. Used both to roll a user forward after a delivery and to give a
 * brand-new account its first delivery time.
 */
export function randomDeliveryTime(after: Date = new Date()): Date {
  const next = new Date(after);
  next.setDate(next.getDate() + 1);
  return withRandomWindowTime(next);
}

/**
 * A new account's first delivery: a random time in today's window if that
 * hasn't passed yet, otherwise tomorrow's. Keeps the first letter from being
 * a whole day away when someone signs up in the morning.
 */
export function firstDeliveryTime(now: Date = new Date()): Date {
  const today = withRandomWindowTime(new Date(now));
  return today > now ? today : randomDeliveryTime(now);
}

function withRandomWindowTime(day: Date): Date {
  const spanMs = (WINDOW_END_HOUR - WINDOW_START_HOUR) * 60 * 60 * 1000;
  day.setHours(WINDOW_START_HOUR, 0, 0, 0);
  return new Date(day.getTime() + Math.floor(Math.random() * spanMs));
}

/**
 * Delivers to every user whose scheduled time has arrived. Safe to call as
 * often as you like — a user is only ever due once, because delivering rolls
 * their `scheduledMail` into the future.
 *
 * Users with a null `scheduledMail` are skipped: `lte` never matches null, and
 * an account without a delivery time hasn't been through the auth callback
 * that assigns one.
 */
export async function deliverDueMail(now: Date = new Date()): Promise<DeliveryReport> {
  const due = await prisma.mailUser.findMany({
    where: { scheduledMail: { lte: now } },
    select: { id: true },
  });

  const report: DeliveryReport = { users: due.length, delivered: 0, archived: 0 };

  for (const user of due) {
    // Per user rather than one bulk update: each delivery has to archive the
    // old window and open the new one atomically, or a reader between the two
    // statements would see either nothing or two windows at once.
    const result = await prisma.$transaction(async (tx) => {
      const retired = await tx.mail.updateMany({
        where: { recipientId: user.id, received: true, archived: false },
        data: { archived: true },
      });

      const delivered = await tx.mail.updateMany({
        where: { recipientId: user.id, received: false, archived: false },
        data: { received: true },
      });

      await tx.mailUser.update({
        where: { id: user.id },
        data: { scheduledMail: randomDeliveryTime(now) },
      });

      return { archived: retired.count, delivered: delivered.count };
    });

    report.delivered += result.delivered;
    report.archived += result.archived;
  }

  return report;
}
