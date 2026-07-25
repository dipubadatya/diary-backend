import { Router } from 'express';
import multer from 'multer';
import { storage } from '../config/cloudinary';
import { isLoggedIn, optionalLoggedIn } from '../middlewares/auth';
import {
  getUserProfile,
  updateProfile,
  updateProfileImage,
  updateBannerImage,
  toggleFollow,
  getFollowers,
  getFollowing,
  getNotifications,
  getUnreadNotificationsCount,
  deleteNotification,
  changePassword,
  deleteBannerImage,
  deleteAccount
} from '../controllers/users';

const router = Router();
const upload = multer({ storage });

router.get('/profile/:username', optionalLoggedIn, getUserProfile);
router.put('/profile', isLoggedIn, updateProfile);
router.put('/profile/image', isLoggedIn, upload.single('image'), updateProfileImage);
router.put('/profile/banner', isLoggedIn, upload.single('image'), updateBannerImage);
router.delete('/profile/banner', isLoggedIn, deleteBannerImage);

router.post('/follow/:id', isLoggedIn, toggleFollow);
router.get('/followers/:id', getFollowers);
router.get('/following/:id', getFollowing);

router.get('/notifications/unread-count', isLoggedIn, getUnreadNotificationsCount);
router.get('/notifications', isLoggedIn, getNotifications);
router.delete('/notifications/:notifId', isLoggedIn, deleteNotification);

router.post('/change-password', isLoggedIn, changePassword);
router.delete('/account', isLoggedIn, deleteAccount);

export default router;
