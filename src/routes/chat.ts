import { Router } from 'express';
import { isLoggedIn } from '../middlewares/auth';
import { getMessages, getConversations } from '../controllers/chat';

const router = Router();

router.get('/conversations', isLoggedIn, getConversations);
router.get('/:receiverId', isLoggedIn, getMessages);

export default router;
