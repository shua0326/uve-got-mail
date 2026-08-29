import { Request, Response } from 'express';
import prisma from "../../database/prisma";
import { firstDeliveryTime } from "../../services/deliveryService";

export async function handleSocialAuthCallback(req: Request, res: Response): Promise<void> {

    try {
        if (!req.supabaseUser) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const user = req.supabaseUser;
        const email = user.user_metadata.email ?? user.email;
        if (!email) {
            res.status(400).json({ error: 'Email is required' });
            return;
        }

        // The frontend can have two of these in flight at once (useSession
        // verifies on both `getSession` and the initial `onAuthStateChange`),
        // and on a first-ever sign-in both take the `create` branch — the
        // loser used to come back P2002 and 500, which surfaced as a
        // "backend didn't answer" banner on the user's very first visit.
        // The row the winner created is exactly what this request wanted, so
        // treat the collision as success and read it back.
        let dbUser = await upsertMailUser(user.id, email);

        // Accounts created before scheduled delivery existed have a null
        // `scheduledMail` and would never be picked up by the delivery pass.
        // Backfill on sign-in rather than in a one-off migration.
        if (!dbUser.scheduledMail) {
            dbUser = await prisma.mailUser.update({
                where: { id: dbUser.id },
                data: { scheduledMail: firstDeliveryTime() },
            });
        }

        req.dbUser = dbUser;
        
        // Successfully authenticated and processed the user
        res.status(200).json({
            message: 'User authenticated successfully',
            user: { id: dbUser.id, email: dbUser.email, username: dbUser.username }
        });
    } catch (dbError) {
        console.error('Database Error:', dbError);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function upsertMailUser(id: string, email: string) {
    try {
        return await prisma.mailUser.upsert({
            where: { id },
            update: {},
            create: {
                id,
                email: email,
                username: email,
                scheduledMail: firstDeliveryTime(),
            }
        });
    } catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
        const existing = await prisma.mailUser.findUnique({ where: { id } });
        // A P2002 with no row to show for it isn't the race — it's a genuine
        // conflict on `email`/`username` with some other account, and the
        // caller should still see a 500.
        if (!existing) throw error;
        console.warn(`[auth] concurrent create for ${id} lost the race; reusing the row the winner made`);
        return existing;
    }
}
