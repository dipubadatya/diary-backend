import { Router } from 'express';
import { isLoggedIn } from '../middlewares/auth';
import { getMessages, getConversations } from '../controllers/chat';
import { validate } from '../middlewares/validate.middleware';
import { getMessagesSchema } from '../validations/message.validation';

const router = Router();

router.get('/conversations', isLoggedIn, getConversations);
router.get('/:receiverId', isLoggedIn, validate(getMessagesSchema), getMessages);

export default router;
