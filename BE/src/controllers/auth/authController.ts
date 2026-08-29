import { Request, Response } from 'express';
import prisma from "../../database/prisma";

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

        const dbUser = await prisma.mailUser.upsert({
            where: { id: user.id },
            update: {},
            create: { id: user.id, email: email, username: email }
        });

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