import { Router } from 'express';
import { isLoggedIn } from '../middlewares/auth';
import { createComment, deleteComment } from '../controllers/comments';

const router = Router({ mergeParams: true }); // Merge params to access :storyId from parent router

router.post('/', isLoggedIn, createComment);
router.delete('/:commentId', isLoggedIn, deleteComment);

export default router;
