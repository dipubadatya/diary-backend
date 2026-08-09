import { Router } from 'express';
import { isLoggedIn } from '../middlewares/auth';
import { createComment, deleteComment, updateComment, likeComment } from '../controllers/comments';

const router = Router({ mergeParams: true }); // Merge params to access :storyId from parent router

router.post('/', isLoggedIn, createComment);
router.delete('/:commentId', isLoggedIn, deleteComment);
router.put('/:commentId', isLoggedIn, updateComment);
router.post('/:commentId/like', isLoggedIn, likeComment);

export default router;
