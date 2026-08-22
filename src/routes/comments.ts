import { Router } from 'express';
import { isLoggedIn } from '../middlewares/auth';
import { createComment, deleteComment, updateComment, likeComment } from '../controllers/comments';
import { validate } from '../middlewares/validate.middleware';
import {
  createCommentSchema,
  deleteCommentSchema,
  updateCommentSchema,
  likeCommentSchema
} from '../validations/comment.validation';

const router = Router({ mergeParams: true }); // Merge params to access :storyId from parent router

router.post('/', isLoggedIn, validate(createCommentSchema), createComment);
router.delete('/:commentId', isLoggedIn, validate(deleteCommentSchema), deleteComment);
router.put('/:commentId', isLoggedIn, validate(updateCommentSchema), updateComment);
router.post('/:commentId/like', isLoggedIn, validate(likeCommentSchema), likeComment);

export default router;
