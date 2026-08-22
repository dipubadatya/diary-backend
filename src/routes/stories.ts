import { Router } from 'express';
import multer from 'multer';
import { storage } from '../config/cloudinary';
import { isLoggedIn, optionalLoggedIn } from '../middlewares/auth';
import { validate } from '../middlewares/validate.middleware';
import {
  getStoriesSchema,
  getStoryByIdSchema,
  createStorySchema,
  updateStorySchema,
  deleteStorySchema,
  likeStorySchema,
  getLikedBySchema,
  downloadStoryPDFSchema,
  searchGifsSchema
} from '../validations/story.validation';

import {
  getStories,
  getStoryById,
  createStory,
  updateStory,
  deleteStory,
  likeStory,
  getLikedBy,
  downloadStoryPDF,
  searchGifs
} from '../controllers/stories';

const router = Router();
const upload = multer({ storage });

router.get('/search-gif', isLoggedIn, validate(searchGifsSchema), searchGifs);
router.get('/', validate(getStoriesSchema), getStories);
router.post('/', isLoggedIn, upload.single('image'), validate(createStorySchema), createStory);

router.get('/:id', optionalLoggedIn, validate(getStoryByIdSchema), getStoryById);
router.put('/:id', isLoggedIn, upload.single('image'), validate(updateStorySchema), updateStory);
router.delete('/:id/delete', isLoggedIn, validate(deleteStorySchema), deleteStory);
router.delete('/:id', isLoggedIn, validate(deleteStorySchema), deleteStory); // Support both formats

router.get('/:id/likes', isLoggedIn, validate(likeStorySchema), likeStory);
router.post('/:id/likes', isLoggedIn, validate(likeStorySchema), likeStory); // Support both formats

router.get('/:id/likedBy', validate(getLikedBySchema), getLikedBy);
router.get('/download/:id', validate(downloadStoryPDFSchema), downloadStoryPDF);

export default router;
