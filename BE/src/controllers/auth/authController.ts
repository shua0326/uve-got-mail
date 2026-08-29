import { Request, Response } from 'express';
import prisma from "../../database/prisma";

export async function handleSocialAuthCallback(req: Request, res: Response): Promise<void> {

    try {
        if (!req.supabaseUser) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        console.log(req.supabaseUser);

        let dbUser = req.dbUser;

        if (!dbUser) {
            try {
                let user = req.supabaseUser;
                const email = user.user_metadata.email ?? user.email;
                if (!email) {
                    res.status(400).json({ error: 'Email is required' });
                    return;
                }

                dbUser = await prisma.mailUser.create({
                    data: {
                        id: user.id,
                        email: email,
                        username: email
                    }
                });

                req.dbUser = dbUser;

            } catch (dbError) {
                console.error('Error updating user ID:', dbError);
                res.status(500).json({ error: 'Internal server error' });
                return;
            }
        }
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