import { createServerClient } from '@supabase/ssr';
import { Request, Response } from 'express';
import * as dotenv from 'dotenv';

dotenv.config();

export const getRequestClient = (req: Request, res: Response) => {
    
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
    }
    
    return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        cookies: {
        getAll() {
            return Object.entries(req.cookies).map(([name, value]) => ({
            name,
            value,
            }));
        },
        setAll(cookies) {
            cookies.forEach(({ name, value, options }) => {
                if (value === '' || value === null) {
                    res.clearCookie(name, {
                    ...options,
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    });
                } else {
                    res.cookie(name, value, {
                        ...options,
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                    });
                }
            });
        }
        },
    });
};