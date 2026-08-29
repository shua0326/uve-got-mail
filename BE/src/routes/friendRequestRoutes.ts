import { Router } from 'express';
import { getFriendRequests, sendFriendRequest, acceptFriendRequest, declineFriendRequest } from '../controllers/friendRequest/friendRequestController';

const router = Router();

router.get('/', getFriendRequests);
router.post('/send/:username', sendFriendRequest);
router.put('/:id/accept', acceptFriendRequest);
router.put('/:id/decline', declineFriendRequest);

export default router;