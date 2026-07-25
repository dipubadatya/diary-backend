import { Router } from 'express';
import multer from 'multer';
import { storage } from '../config/cloudinary';
import { isLoggedIn, optionalLoggedIn } from '../middlewares/auth';
import { validateStory, validateStoryUpdate } from '../middlewares/validation';
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

router.get('/search-gif', isLoggedIn, searchGifs);
router.get('/', getStories);
router.post('/', isLoggedIn, upload.single('image'), validateStory, createStory);

router.get('/:id', optionalLoggedIn, getStoryById);
router.put('/:id', isLoggedIn, upload.single('image'), validateStoryUpdate, updateStory);
router.delete('/:id/delete', isLoggedIn, deleteStory);
router.delete('/:id', isLoggedIn, deleteStory); // Support both formats

router.get('/:id/likes', isLoggedIn, likeStory);
router.post('/:id/likes', isLoggedIn, likeStory); // Support both formats

router.get('/:id/likedBy', getLikedBy);
router.get('/download/:id', downloadStoryPDF);

export default router;
