import { Request, Response } from 'express';
import prisma from "../../database/prisma";

export async function handleSocialAuthCallback(req: Request, res: Response): Promise<void> {
    
    try {
        if (!req.supabaseUser) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        
        console.log(req.supabaseUser);
        
        if (!req.dbUser) {
            try {
                let user = req.supabaseUser;
                if (!user.email) {
                    res.status(400).json({ error: 'Email is required' });
                    return;
                }
                
                const dbUser = await prisma.staff.create({
                    data: {
                        id: user.id,
                        email: user.email,
                        name: user.user_metadata.name
                    }
                });
                
                req.dbUser = dbUser;

            } catch (dbError) {
                console.error('Error updating user ID:', dbError);
                return;
            }
        }   
        // Successfully authenticated and processed the user
        res.status(200).json({ 
            message: 'User authenticated successfully',
            role: req.dbUser.role
        });
    } catch (dbError) {
        console.error('Database Error:', dbError);
        res.status(500).json({ error: 'Internal server error' });
    }
}