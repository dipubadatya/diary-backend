import { Router } from 'express';
import multer from 'multer';
import { storage } from '../config/cloudinary';
import { isLoggedIn, optionalLoggedIn } from '../middlewares/auth';
import { validate } from '../middlewares/validate.middleware';
import {
  searchWritersSchema,
  existingUsernameSchema,
  addRecentSearchSchema,
  removeRecentSearchSchema,
  getUserProfileSchema,
  updateProfileSchema,
  toggleFollowSchema,
  getFollowersSchema,
  getFollowingSchema,
  deleteNotificationSchema,
  changePasswordSchema
} from '../validations/user.validation';
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
  deleteAccount,
  searchWriters,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  existingUsername
} from '../controllers/users';

const router = Router();
const upload = multer({ storage });

router.get('/search', optionalLoggedIn, validate(searchWritersSchema), searchWriters);
router.get('/check-username/:username', validate(existingUsernameSchema), existingUsername);
router.post('/recent-searches', isLoggedIn, validate(addRecentSearchSchema), addRecentSearch);
router.delete('/recent-searches/:id', isLoggedIn, validate(removeRecentSearchSchema), removeRecentSearch);
router.delete('/recent-searches', isLoggedIn, clearRecentSearches);

router.get('/profile/:username', optionalLoggedIn, validate(getUserProfileSchema), getUserProfile);
router.put('/profile', isLoggedIn, validate(updateProfileSchema), updateProfile);
router.put('/profile/image', isLoggedIn, upload.single('image'), updateProfileImage);
router.put('/profile/banner', isLoggedIn, upload.single('image'), updateBannerImage);
router.delete('/profile/banner', isLoggedIn, deleteBannerImage);

router.post('/follow/:id', isLoggedIn, validate(toggleFollowSchema), toggleFollow);
router.get('/followers/:id', validate(getFollowersSchema), getFollowers);
router.get('/following/:id', validate(getFollowingSchema), getFollowing);

router.get('/notifications/unread-count', isLoggedIn, getUnreadNotificationsCount);
router.get('/notifications', isLoggedIn, getNotifications);
router.delete('/notifications/:notifId', isLoggedIn, validate(deleteNotificationSchema), deleteNotification);

router.post('/change-password', isLoggedIn, validate(changePasswordSchema), changePassword);
router.delete('/account', isLoggedIn, deleteAccount);

export default router;
