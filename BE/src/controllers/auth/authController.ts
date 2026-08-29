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

        let dbUser = await prisma.mailUser.upsert({
            where: { id: user.id },
            update: {},
            create: {
                id: user.id,
                email: email,
                username: email,
                scheduledMail: firstDeliveryTime(),
            }
        });

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