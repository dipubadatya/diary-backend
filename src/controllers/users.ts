// import { Request, Response, NextFunction } from 'express';
// import User from '../models/user';
// import Story from '../models/story';
// import Comment from '../models/comment';
// import { cloudinary } from '../config/cloudinary';
// import moment from 'moment';

// export const getUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const { username } = req.params;
//     const currentUserId = req.user ? (req.user as any)._id : null;

//     const isObjectId = /^[0-9a-fA-F]{24}$/.test(username);
//     const query = isObjectId ? { _id: username } : { username };

//     const user = await User.findOne(query)
//       .select('-salt -hash -verificationToken -verificationTokenExpires -resetPasswordToken -resetPasswordExpires');

//     if (!user) {
//        res.status(404).json({ error: 'User not found.' });
//        return;
//     }

//     // Aggregate statistics
//     const stats = await Story.aggregate([
//       {
//         $match: {
//           owner: user._id
//         }
//       },
//       {
//         $group: {
//           _id: '$owner',
//           totalStories: { $sum: 1 },
//           totalViews: { $sum: { $size: { $ifNull: ['$views', []] } } }
//         }
//       }
//     ]);

//     const userStats = stats.length > 0 ? stats[0] : { totalStories: 0, totalViews: 0 };

//     // Fetch user stories populated with owner and comments count
//     const stories = await Story.find({ owner: user._id })
//       .sort({ timeStamp: -1 })
//       .populate('owner', 'username name image');

//     const isFollowing = currentUserId ? user.followers.some(fid => fid.toString() === currentUserId.toString()) : false;
//     const followsMe = currentUserId ? user.following.some(fid => fid.toString() === currentUserId.toString()) : false;

//     res.status(200).json({
//       success: true,
//       profile: {
//         _id: user._id,
//         name: user.name,
//         username: user.username,
//         email: user.email,
//         image: user.image,
//         banner: user.banner,
//         bio: user.bio,
//         followersCount: user.followers.length,
//         followingCount: user.following.length,
//         storiesCount: user.stories.length,
//         isOnline: user.isOnline,
//         lastSeen: user.lastSeen,
//         createdAt: user.createdAt
//       },
//       stories,
//       stats: {
//         totalStories: userStats.totalStories || 0,
//         totalViews: userStats.totalViews || 0
//       },
//       isFollowing,
//       followsMe
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const userId = (req.user as any)._id;
//     const { name, username, bio } = req.body;

//     const user = await User.findById(userId);
//     if (!user) {
//        res.status(404).json({ error: 'User not found.' });
//        return;
//     }

//     if (username && username !== user.username) {
//       const usernameExists = await User.findOne({ username });
//       if (usernameExists) {
//          res.status(400).json({ error: 'Username is already taken.' });
//          return;
//       }
//       user.username = username;
//     }

//     user.name = name || user.name;
//     user.bio = bio || user.bio;

//     await user.save();

//     res.status(200).json({
//       success: true,
//       message: 'Profile updated successfully.',
//       user: {
//         _id: user._id,
//         name: user.name,
//         username: user.username,
//         email: user.email,
//         image: user.image,
//         banner: user.banner,
//         bio: user.bio,
//         followersCount: user.followers.length,
//         followingCount: user.following.length,
//         storiesCount: user.stories.length
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const updateProfileImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const userId = (req.user as any)._id;
//     if (!req.file) {
//        res.status(400).json({ error: 'Image file is required.' });
//        return;
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//        res.status(404).json({ error: 'User not found.' });
//        return;
//     }

//     // Destroy old avatar if customized
//     if (user.image?.publicId) {
//       try {
//         await cloudinary.uploader.destroy(user.image.publicId);
//       } catch (err) {
//         console.error('Failed to delete old profile image:', err);
//       }
//     }

//     user.image = {
//       url: req.file.path,
//       filename: req.file.filename,
//       publicId: req.file.filename
//     };

//     await user.save();

//     res.status(200).json({
//       success: true,
//       message: 'Profile image updated successfully.',
//       imageUrl: user.image.url
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const updateBannerImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const userId = (req.user as any)._id;
//     if (!req.file) {
//        res.status(400).json({ error: 'Banner image file is required.' });
//        return;
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//        res.status(404).json({ error: 'User not found.' });
//        return;
//     }

//     // Destroy old banner if customized
//     if (user.banner?.publicId) {
//       try {
//         await cloudinary.uploader.destroy(user.banner.publicId);
//       } catch (err) {
//         console.error('Failed to delete old banner image:', err);
//       }
//     }

//     user.banner = {
//       url: req.file.path,
//       filename: req.file.filename,
//       publicId: req.file.filename
//     };

//     await user.save();

//     res.status(200).json({
//       success: true,
//       message: 'Banner image updated successfully.',
//       bannerUrl: user.banner.url
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const toggleFollow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const { id } = req.params; // Target user id
//     const currentUserId = (req.user as any)._id;

//     if (id === currentUserId.toString()) {
//        res.status(400).json({ error: 'You cannot follow yourself.' });
//        return;
//     }

//     const targetUser = await User.findById(id);
//     const currentUser = await User.findById(currentUserId);

//     if (!targetUser || !currentUser) {
//        res.status(404).json({ error: 'User not found.' });
//        return;
//     }

//     const alreadyFollowing = currentUser.following.some(fid => fid.toString() === targetUser._id.toString());

//     if (alreadyFollowing) {
//       // Unfollow
//       currentUser.following = currentUser.following.filter(uid => !uid.equals(targetUser._id));
//       targetUser.followers = targetUser.followers.filter(uid => !uid.equals(currentUser._id));
//     } else {
//       // Follow
//       currentUser.following.push(targetUser._id as any);
//       targetUser.followers.push(currentUser._id as any);

//       // Create notification
//       targetUser.notifications.push({
//         type: 'follow',
//         fromUser: currentUser._id as any,
//         timeStamp: new Date(),
//         read: false
//       });

//       // Emit socket notification
//       const io = req.app.get('io');
//       if (io) {
//         io.to(targetUser._id.toString()).emit('newNotification', {
//           type: 'follow',
//           fromUser: {
//             _id: currentUser._id,
//             username: currentUser.username,
//             image: currentUser.image
//           }
//         });
//       }
//     }

//     await currentUser.save();
//     await targetUser.save();

//     res.status(200).json({
//       success: true,
//       isFollowing: !alreadyFollowing,
//       followersCount: targetUser.followers.length,
//       followingCount: currentUser.following.length,
//       message: alreadyFollowing ? 'Unfollowed successfully.' : 'Followed successfully.'
//     });
//   } catch (error) {
//     next(error);
//   }
// };


// export const getFollowers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const { id } = req.params;
//     const user = await User.findById(id).populate('followers', 'username name image bio');
//     if (!user) {
//        res.status(404).json({ error: 'User not found.' });
//        return;
//     }

//     res.status(200).json({
//       success: true,
//       followers: user.followers
//     });
//   } catch (error) {
//     next(error);
//   }
// };


// export const getFollowing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const { id } = req.params;
//     const user = await User.findById(id).populate('following', 'username name image bio');
//     if (!user) {
//        res.status(404).json({ error: 'User not found.' });
//        return;
//     }

//     res.status(200).json({
//       success: true,
//       following: user.following
//     });
//   } catch (error) {
//     next(error);
//   }
// };


// export const getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const userId = (req.user as any)._id;

//     const user = await User.findById(userId).populate({
//       path: 'notifications.fromUser',
//       select: 'username name image'
//     });

//     if (!user) {
//        res.status(404).json({ error: 'User not found.' });
//        return;
//     }

//     // Sort notifications in descending time
//     const sortedNotifications = user.notifications.sort((a, b) => b.timeStamp.getTime() - a.timeStamp.getTime());

//     // Mark notifications as read
//     let needsSave = false;
//     user.notifications.forEach(n => {
//       if (!n.read) {
//         n.read = true;
//         needsSave = true;
//       }
//     });
//     if (needsSave) {
//       await user.save();
//     }

//     // Grouping
//     const today: any[] = [];
//     const yesterday: any[] = [];
//     const older: any[] = [];

//     const startOfToday = moment().startOf('day');
//     const startOfYesterday = moment().subtract(1, 'days').startOf('day');

//     sortedNotifications.forEach(notif => {
//       const notifTime = moment(notif.timeStamp);
//       if (notifTime.isSameOrAfter(startOfToday)) {
//         today.push(notif);
//       } else if (notifTime.isSameOrAfter(startOfYesterday)) {
//         yesterday.push(notif);
//       } else {
//         older.push(notif);
//       }
//     });

//     res.status(200).json({
//       success: true,
//       notifications: {
//         today,
//         yesterday,
//         older
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };


// export const getUnreadNotificationsCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const userId = (req.user as any)._id;
//     const user = await User.findById(userId);
//     if (!user) {
//        res.status(404).json({ error: 'User not found.' });
//        return;
//     }
//     const unreadCount = user.notifications.filter(n => !n.read).length;
//     res.status(200).json({
//       success: true,
//       unreadCount
//     });
//   } catch (error) {
//     next(error);
//   }
// };


// export const deleteNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const userId = (req.user as any)._id;
//     const { notifId } = req.params;

//     const user = await User.findById(userId);
//     if (!user) {
//        res.status(404).json({ error: 'User not found.' });
//        return;
//     }

//     user.notifications = user.notifications.filter(n => n._id?.toString() !== notifId);
//     await user.save();

//     res.status(200).json({
//       success: true,
//       message: 'Notification deleted.'
//     });
//   } catch (error) {
//     next(error);
//   }
// };


// export const changePassword = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
//   try {
//     const userId = (req.user as any)._id;
//     const { currentPassword, newPassword } = req.body;

//     if (!currentPassword || !newPassword) {
//        res.status(400).json({ error: 'Current password and new password are required.' });
//        return;
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//        res.status(404).json({ error: 'User not found.' });
//        return;
//     }

//     await (user as any).changePassword(currentPassword, newPassword);

//     res.status(200).json({
//       success: true,
//       message: 'Password changed successfully.'
//     });
//   } catch (error: any) {
//     res.status(400).json({ error: error.message || 'Failed to change password. Make sure current password is correct.' });
//   }
// };


// export const deleteAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const userId = (req.user as any)._id;

//     const user = await User.findById(userId);
//     if (!user) {
//        res.status(404).json({ error: 'User not found.' });
//        return;
//     }

//     // Clean up images in Cloudinary
//     if (user.image?.publicId) {
//       try { await cloudinary.uploader.destroy(user.image.publicId); } catch {}
//     }
//     if (user.banner?.publicId) {
//       try { await cloudinary.uploader.destroy(user.banner.publicId); } catch {}
//     }

//     // Clean up user's stories (Mongoose Story hook handles sub-references)
//     const userStories = await Story.find({ owner: userId });
//     for (const story of userStories) {
//       if (story.image?.publicId) {
//         try { await cloudinary.uploader.destroy(story.image.publicId); } catch {}
//       }
//       await Story.findByIdAndDelete(story._id);
//     }

//     // Clean up user comments
//     await Comment.deleteMany({ author: userId });

//     // Delete user document
//     await User.findByIdAndDelete(userId);

//     // Logout and destroy session
//     const expressReq = req as any;
//     expressReq.logout((err: any) => {
//       if (err) return next(err);
//       expressReq.session.destroy((destroyErr: any) => {
//         if (destroyErr) return next(destroyErr);
//         res.clearCookie('connect.sid');
//         res.status(200).json({
//           success: true,
//           message: 'Account deleted successfully.'
//         });
//       });
//     });
//   } catch (error) {
//     next(error);
//   }
// };


// export const deleteBannerImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const userId = (req.user as any)._id;
//     const user = await User.findById(userId);
//     if (!user) {
//        res.status(404).json({ error: 'User not found.' });
//        return;
//     }

//     if (user.banner?.publicId) {
//       try {
//         await cloudinary.uploader.destroy(user.banner.publicId);
//       } catch (err) {
//         console.error('Failed to destroy banner:', err);
//       }
//     }

//     user.banner = { url: '', filename: '', publicId: '' };
//     await user.save();

//     res.status(200).json({
//       success: true,
//       message: 'Cover photo removed successfully.'
//     });
//   } catch (error) {
//     next(error);
//   }
// };


import { Request, Response, NextFunction } from 'express';
import User from '../models/user';
import Story from '../models/story';
import Comment from '../models/comment';
import { cloudinary } from '../config/cloudinary';
import moment from 'moment';
import mongoose from 'mongoose';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const isValidObjectId = (id: string): boolean =>
  mongoose.Types.ObjectId.isValid(id);

const sanitizeString = (str: string, maxLength: number): string =>
  str?.toString().trim().slice(0, maxLength) || '';

const buildUserProfileResponse = (user: any) => ({
  _id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  image: user.image,
  banner: user.banner,
  bio: user.bio,
  followersCount: user.followers?.length ?? 0,
  followingCount: user.following?.length ?? 0,
  storiesCount: user.stories?.length ?? 0,
  isOnline: user.isOnline,
  lastSeen: user.lastSeen,
  createdAt: user.createdAt,
});

// ─────────────────────────────────────────────
// GET USER PROFILE
// ─────────────────────────────────────────────

export const getUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username } = req.params;
    const currentUserId = req.user ? (req.user as any)._id : null;

    if (!username || username.trim() === '') {
      res.status(400).json({ error: 'Username or ID is required.' });
      return;
    }

    // Safe query builder
    const query =
      isValidObjectId(username) && username.length === 24
        ? { _id: username }
        : { username: username.trim() }; // ← removed toLowerCase() to match your DB

    const user = await User.findOne(query).select(
      '-salt -hash -verificationToken -verificationTokenExpires ' +
        '-resetPasswordToken -resetPasswordExpires -__v'
    );

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(20, parseInt(req.query.limit as string) || 10);
    const skip = (page - 1) * limit;

    const [stats, stories, totalStories] = await Promise.all([
      Story.aggregate([
        { $match: { owner: user._id } },
        {
          $group: {
            _id: '$owner',
            totalStories: { $sum: 1 },
            totalViews: {
              $sum: { $size: { $ifNull: ['$views', []] } },
            },
          },
        },
      ]),
      Story.find({ owner: user._id })
        .sort({ timeStamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('owner', 'username name image')
        .lean(),
      Story.countDocuments({ owner: user._id }),
    ]);

    const userStats =
      stats.length > 0 ? stats[0] : { totalStories: 0, totalViews: 0 };

    const isFollowing = currentUserId
      ? user.followers.some(
          (fid: any) => fid.toString() === currentUserId.toString()
        )
      : false;

    const followsMe = currentUserId
      ? user.following.some(
          (fid: any) => fid.toString() === currentUserId.toString()
        )
      : false;

    const isOwnProfile = currentUserId
      ? currentUserId.toString() === user._id.toString()
      : false;

    res.status(200).json({
      success: true,
      profile: {
        ...buildUserProfileResponse(user),
        isOwnProfile,
      },
      stories,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalStories / limit),
        totalStories,
        hasNextPage: page * limit < totalStories,
        hasPrevPage: page > 1,
      },
      stats: {
        totalStories: userStats.totalStories ?? 0,
        totalViews: userStats.totalViews ?? 0,
      },
      isFollowing,
      followsMe,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// UPDATE PROFILE
// ─────────────────────────────────────────────

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;
    const { name, username, bio } = req.body;

    if (!name && !username && !bio) {
      res
        .status(400)
        .json({ error: 'At least one field is required to update.' });
      return;
    }

    const sanitizedName = name ? sanitizeString(name, 50) : undefined;
    // ← NO toLowerCase() here - preserves your existing username casing
    const sanitizedUsername = username
      ? sanitizeString(username, 30)
      : undefined;
    const sanitizedBio = bio !== undefined ? sanitizeString(bio, 300) : undefined;

    if (sanitizedUsername && !/^[a-zA-Z0-9_]+$/.test(sanitizedUsername)) {
      res.status(400).json({
        error:
          'Username can only contain letters, numbers, and underscores.',
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (sanitizedUsername && sanitizedUsername !== user.username) {
      const usernameExists = await User.findOne({
        username: sanitizedUsername,
        _id: { $ne: userId }, // exclude current user - fixes original bug
      });

      if (usernameExists) {
        res.status(409).json({ error: 'Username is already taken.' });
        return;
      }
      user.username = sanitizedUsername;
    }

    if (sanitizedName) user.name = sanitizedName;
    // Allow empty bio (clearing it) - original code didn't allow this
    if (sanitizedBio !== undefined) user.bio = sanitizedBio;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: buildUserProfileResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// UPDATE PROFILE IMAGE
// ─────────────────────────────────────────────

export const updateProfileImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;

    if (!req.file) {
      res.status(400).json({ error: 'Image file is required.' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Save old publicId before overwriting
    const oldPublicId = user.image?.publicId;

    user.image = {
      url: req.file.path,
      filename: req.file.filename,
      publicId: req.file.filename,
    };

    await user.save();

    // Delete old image AFTER successful save (non-blocking)
    if (oldPublicId) {
      cloudinary.uploader
        .destroy(oldPublicId)
        .catch((err) =>
          console.error('Failed to delete old profile image:', err)
        );
    }

    res.status(200).json({
      success: true,
      message: 'Profile image updated successfully.',
      image: user.image,
    });
  } catch (error) {
    // Cleanup uploaded file if save failed
    if (req.file?.filename) {
      cloudinary.uploader
        .destroy(req.file.filename)
        .catch((err) => console.error('Cloudinary cleanup failed:', err));
    }
    next(error);
  }
};

// ─────────────────────────────────────────────
// UPDATE BANNER IMAGE
// ─────────────────────────────────────────────

export const updateBannerImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;

    if (!req.file) {
      res.status(400).json({ error: 'Banner image file is required.' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const oldPublicId = user.banner?.publicId;

    user.banner = {
      url: req.file.path,
      filename: req.file.filename,
      publicId: req.file.filename,
    };

    await user.save();

    if (oldPublicId) {
      cloudinary.uploader
        .destroy(oldPublicId)
        .catch((err) =>
          console.error('Failed to delete old banner image:', err)
        );
    }

    res.status(200).json({
      success: true,
      message: 'Banner image updated successfully.',
      banner: user.banner,
    });
  } catch (error) {
    if (req.file?.filename) {
      cloudinary.uploader
        .destroy(req.file.filename)
        .catch((err) => console.error('Cloudinary cleanup failed:', err));
    }
    next(error);
  }
};

// ─────────────────────────────────────────────
// TOGGLE FOLLOW
// ─────────────────────────────────────────────

export const toggleFollow = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUserId = (req.user as any)._id;

    if (!isValidObjectId(id)) {
      res.status(400).json({ error: 'Invalid user ID.' });
      return;
    }

    if (id === currentUserId.toString()) {
      res.status(400).json({ error: 'You cannot follow yourself.' });
      return;
    }

    const [targetUser, currentUser] = await Promise.all([
      User.findById(id),
      User.findById(currentUserId),
    ]);

    if (!targetUser || !currentUser) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const alreadyFollowing = currentUser.following.some(
      (fid: any) => fid.toString() === targetUser._id.toString()
    );

    if (alreadyFollowing) {
      // Atomic unfollow
      await Promise.all([
        User.findByIdAndUpdate(currentUserId, {
          $pull: { following: targetUser._id },
        }),
        User.findByIdAndUpdate(targetUser._id, {
          $pull: { followers: currentUser._id },
        }),
      ]);
    } else {
      // Atomic follow (addToSet prevents duplicates)
      await Promise.all([
        User.findByIdAndUpdate(currentUserId, {
          $addToSet: { following: targetUser._id },
        }),
        User.findByIdAndUpdate(targetUser._id, {
          $addToSet: { followers: currentUser._id },
        }),
      ]);

      // Prevent duplicate follow notifications
      const alreadyNotified = targetUser.notifications.some(
        (n: any) =>
          n.type === 'follow' &&
          n.fromUser?.toString() === currentUser._id.toString()
      );

      if (!alreadyNotified) {
        await User.findByIdAndUpdate(targetUser._id, {
          $push: {
            notifications: {
              type: 'follow',
              fromUser: currentUser._id,
              timeStamp: new Date(),
              read: false,
            },
          },
        });

        const io = req.app.get('io');
        if (io) {
          io.to(targetUser._id.toString()).emit('newNotification', {
            type: 'follow',
            fromUser: {
              _id: currentUser._id,
              username: currentUser.username,
              image: currentUser.image,
            },
            timeStamp: new Date(),
          });
        }
      }
    }

    // Get fresh counts
    const [updatedTarget, updatedCurrent] = await Promise.all([
      User.findById(targetUser._id).select('followers'),
      User.findById(currentUserId).select('following'),
    ]);

    res.status(200).json({
      success: true,
      isFollowing: !alreadyFollowing,
      followersCount: updatedTarget?.followers?.length ?? 0,
      followingCount: updatedCurrent?.following?.length ?? 0,
      message: alreadyFollowing
        ? 'Unfollowed successfully.'
        : 'Followed successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// GET FOLLOWERS - Fixed populate pagination bug
// ─────────────────────────────────────────────

export const getFollowers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ error: 'Invalid user ID.' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;

    const user = await User.findById(id).select('followers');
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const total = user.followers.length;
    // Slice IDs then fetch - correct pagination approach
    const paginatedIds = user.followers.slice(skip, skip + limit);

    const followers = await User.find({ _id: { $in: paginatedIds } })
      .select('username name image bio')
      .lean();

    res.status(200).json({
      success: true,
      followers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
        hasNextPage: skip + limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// GET FOLLOWING - Fixed populate pagination bug
// ─────────────────────────────────────────────

export const getFollowing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ error: 'Invalid user ID.' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;

    const user = await User.findById(id).select('following');
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const total = user.following.length;
    const paginatedIds = user.following.slice(skip, skip + limit);

    const following = await User.find({ _id: { $in: paginatedIds } })
      .select('username name image bio')
      .lean();

    res.status(200).json({
      success: true,
      following,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
        hasNextPage: skip + limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// GET NOTIFICATIONS
// ─────────────────────────────────────────────

export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;

    const user = await User.findById(userId).populate({
      path: 'notifications.fromUser',
      select: 'username name image',
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Sort newest first (avoid mutating original)
    const sortedNotifications = [...user.notifications].sort(
      (a: any, b: any) =>
        new Date(b.timeStamp).getTime() - new Date(a.timeStamp).getTime()
    );

    // Mark unread as read (non-blocking background operation)
    const hasUnread = user.notifications.some((n: any) => !n.read);
    if (hasUnread) {
      User.updateMany(
        { _id: userId, 'notifications.read': false },
        { $set: { 'notifications.$[elem].read': true } },
        { arrayFilters: [{ 'elem.read': false }] }
      ).catch((err) =>
        console.error('Failed to mark notifications as read:', err)
      );
    }

    const today: any[] = [];
    const yesterday: any[] = [];
    const older: any[] = [];

    const startOfToday = moment().startOf('day');
    const startOfYesterday = moment().subtract(1, 'days').startOf('day');

    sortedNotifications.forEach((notif: any) => {
      const notifTime = moment(notif.timeStamp);
      if (notifTime.isSameOrAfter(startOfToday)) {
        today.push(notif);
      } else if (notifTime.isSameOrAfter(startOfYesterday)) {
        yesterday.push(notif);
      } else {
        older.push(notif);
      }
    });

    res.status(200).json({
      success: true,
      notifications: { today, yesterday, older },
      totalCount: sortedNotifications.length,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// GET UNREAD NOTIFICATIONS COUNT
// ─────────────────────────────────────────────

export const getUnreadNotificationsCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;

    // Efficient aggregation - no full doc load
    const result = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(userId.toString()),
        },
      },
      { $unwind: '$notifications' },
      { $match: { 'notifications.read': false } },
      { $count: 'unreadCount' },
    ]);

    const unreadCount = result.length > 0 ? result[0].unreadCount : 0;

    res.status(200).json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// DELETE NOTIFICATION
// ─────────────────────────────────────────────

export const deleteNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;
    const { notifId } = req.params;

    if (!isValidObjectId(notifId)) {
      res.status(400).json({ error: 'Invalid notification ID.' });
      return;
    }

    // Atomic pull - only removes if it belongs to this user
    const result = await User.findByIdAndUpdate(
      userId,
      { $pull: { notifications: { _id: new mongoose.Types.ObjectId(notifId) } } },
      { new: true }
    );

    if (!result) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted.',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// CHANGE PASSWORD
// ─────────────────────────────────────────────

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        error: 'Current password and new password are required.',
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        error: 'New password must be at least 8 characters long.',
      });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({
        error: 'New password must be different from the current password.',
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    await (user as any).changePassword(currentPassword, newPassword);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error: any) {
    // passport-local-mongoose throws IncorrectPasswordError
    if (
      error.name === 'IncorrectPasswordError' ||
      error.message?.toLowerCase().includes('password')
    ) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
    next(error);
  }
};

// ─────────────────────────────────────────────
// DELETE ACCOUNT
// ─────────────────────────────────────────────

export const deleteAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Fetch stories for cloudinary cleanup (only image field needed)
    const userStories = await Story.find({ owner: userId }).select('image');

    // Collect all Cloudinary public IDs
    const cloudinaryIds: string[] = [];
    if (user.image?.publicId) cloudinaryIds.push(user.image.publicId);
    if (user.banner?.publicId) cloudinaryIds.push(user.banner.publicId);
    userStories.forEach((story: any) => {
      if (story.image?.publicId) cloudinaryIds.push(story.image.publicId);
    });

    // Run all DB cleanup in parallel
    await Promise.all([
      Story.deleteMany({ owner: userId }),
      Comment.deleteMany({ author: userId }),
      // Remove from other users' followers/following arrays
      User.updateMany(
        { followers: userId },
        { $pull: { followers: userId } }
      ),
      User.updateMany(
        { following: userId },
        { $pull: { following: userId } }
      ),
      User.findByIdAndDelete(userId),
    ]);

    // Clean up Cloudinary assets (non-blocking, after DB cleanup)
    if (cloudinaryIds.length > 0) {
      Promise.all(
        cloudinaryIds.map((pid) =>
          cloudinary.uploader
            .destroy(pid)
            .catch((err) =>
              console.error(`Cloudinary delete failed for ${pid}:`, err)
            )
        )
      ).catch(() => {});
    }

    // Handle logout + session destroy
    const expressReq = req as any;
    expressReq.logout((err: any) => {
      if (err) return next(err);
      expressReq.session.destroy((destroyErr: any) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie('connect.sid');
        res.status(200).json({
          success: true,
          message: 'Account deleted successfully.',
        });
      });
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// DELETE BANNER IMAGE
// ─────────────────────────────────────────────

export const deleteBannerImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (!user.banner?.publicId) {
      res.status(400).json({ error: 'No banner image to remove.' });
      return;
    }

    const oldPublicId = user.banner.publicId;

    // Clear banner in DB first
    user.banner = { url: '', filename: '', publicId: '' };
    await user.save();

    // Then delete from Cloudinary (non-blocking)
    cloudinary.uploader
      .destroy(oldPublicId)
      .catch((err) =>
        console.error('Failed to destroy banner from Cloudinary:', err)
      );

    res.status(200).json({
      success: true,
      message: 'Cover photo removed successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// SEARCH WRITERS & RECENT SEARCHES
// ─────────────────────────────────────────────

const escapeRegex = (string: string): string => {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

export const searchWriters = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const q = req.query.q ? (req.query.q as string).trim() : '';
    const currentUserId = req.user ? (req.user as any)._id : null;

    if (!q) {
      if (currentUserId) {
        const user = await User.findById(currentUserId).populate({
          path: 'recentSearches',
          select: 'username name image followers following',
        });
        
        if (!user) {
          res.status(200).json({ success: true, results: [] });
          return;
        }

        const results = (user.recentSearches || []).filter(Boolean).map((u: any) => {
          const isFollowing = currentUserId
            ? u.followers?.some((fid: any) => fid.toString() === currentUserId.toString())
            : false;
          const followsMe = currentUserId
            ? u.following?.some((fid: any) => fid.toString() === currentUserId.toString())
            : false;
          return {
            _id: u._id,
            name: u.name,
            username: u.username,
            image: u.image,
            isFollowing,
            followsMe,
          };
        });

        res.status(200).json({ success: true, results });
        return;
      }
      res.status(200).json({ success: true, results: [] });
      return;
    }

    const searchRegex = new RegExp(escapeRegex(q), 'i');
    
    const matchingUsers = await User.find({
      $or: [
        { username: searchRegex },
        { name: searchRegex }
      ]
    })
      .select('username name image followers following')
      .limit(50)
      .lean();

    const scoredUsers = matchingUsers.map((user: any) => {
      const lowerQ = q.toLowerCase();
      const lowerUsername = (user.username || '').toLowerCase();
      const lowerName = (user.name || '').toLowerCase();

      let textScore = 0;
      
      if (lowerUsername === lowerQ || lowerName === lowerQ) {
        textScore = 1000;
      } else if (lowerUsername.startsWith(lowerQ) || lowerName.startsWith(lowerQ)) {
        textScore = 500;
      } else {
        textScore = 100;
      }

      let relationshipScore = 0;
      let isFollowing = false;
      let followsMe = false;

      if (currentUserId) {
        isFollowing = user.followers?.some((fid: any) => fid.toString() === currentUserId.toString()) ?? false;
        followsMe = user.following?.some((fid: any) => fid.toString() === currentUserId.toString()) ?? false;
        
        if (isFollowing) {
          relationshipScore += 20;
        }
        if (followsMe) {
          relationshipScore += 10;
        }
        if (isFollowing && followsMe) {
          relationshipScore += 15;
        }
      }

      const totalScore = textScore + relationshipScore;

      return {
        user,
        score: totalScore,
        followersCount: user.followers?.length ?? 0,
        isFollowing,
        followsMe,
      };
    });

    scoredUsers.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.followersCount - a.followersCount;
    });

    const results = scoredUsers.map((item) => ({
      _id: item.user._id,
      name: item.user.name,
      username: item.user.username,
      image: item.user.image,
      isFollowing: item.isFollowing,
      followsMe: item.followsMe,
    }));

    res.status(200).json({ success: true, results });
  } catch (error) {
    next(error);
  }
};

export const addRecentSearch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { writerId } = req.body;
    const currentUserId = (req.user as any)._id;

    if (!writerId || !isValidObjectId(writerId)) {
      res.status(400).json({ error: 'Invalid writer ID.' });
      return;
    }

    const writer = await User.findById(writerId);
    if (!writer) {
      res.status(404).json({ error: 'Writer not found.' });
      return;
    }

    const user = await User.findById(currentUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (!user.recentSearches) {
      user.recentSearches = [];
    }

    user.recentSearches = user.recentSearches.filter(
      (id) => id.toString() !== writerId.toString()
    );

    user.recentSearches.unshift(new mongoose.Types.ObjectId(writerId));

    if (user.recentSearches.length > 10) {
      user.recentSearches = user.recentSearches.slice(0, 10);
    }

    await user.save();

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const removeRecentSearch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUserId = (req.user as any)._id;

    if (!id || !isValidObjectId(id)) {
      res.status(400).json({ error: 'Invalid writer ID.' });
      return;
    }

    const user = await User.findById(currentUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (user.recentSearches) {
      user.recentSearches = user.recentSearches.filter(
        (rid) => rid.toString() !== id.toString()
      );
      await user.save();
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const clearRecentSearches = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = (req.user as any)._id;

    const user = await User.findById(currentUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    user.recentSearches = [];
    await user.save();

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};