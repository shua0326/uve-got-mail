import { Router } from 'express';
import { 
    handleSocialAuthCallback
} from '../controllers/auth/authController';
import { requireLogIn } from '../middlewares/authMiddleware';

const router = Router();

router.post('/callback', requireLogIn, handleSocialAuthCallback);

export default router;