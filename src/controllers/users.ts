import { Request, Response, NextFunction } from 'express';
import User from '../models/user';
import Story from '../models/story';
import Comment from '../models/comment';
import { cloudinary } from '../config/cloudinary';
import moment from 'moment';

export const getUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username } = req.params;
    const currentUserId = req.user ? (req.user as any)._id : null;

    const isObjectId = /^[0-9a-fA-F]{24}$/.test(username);
    const query = isObjectId ? { _id: username } : { username };

    const user = await User.findOne(query)
      .select('-salt -hash -verificationToken -verificationTokenExpires -resetPasswordToken -resetPasswordExpires');

    if (!user) {
       res.status(404).json({ error: 'User not found.' });
       return;
    }

    // Aggregate statistics
    const stats = await Story.aggregate([
      {
        $match: {
          owner: user._id
        }
      },
      {
        $group: {
          _id: '$owner',
          totalStories: { $sum: 1 },
          totalViews: { $sum: { $size: { $ifNull: ['$views', []] } } }
        }
      }
    ]);

    const userStats = stats.length > 0 ? stats[0] : { totalStories: 0, totalViews: 0 };

    // Fetch user stories populated with owner and comments count
    const stories = await Story.find({ owner: user._id })
      .sort({ timeStamp: -1 })
      .populate('owner', 'username name image');

    const isFollowing = currentUserId ? user.followers.some(fid => fid.toString() === currentUserId.toString()) : false;
    const followsMe = currentUserId ? user.following.some(fid => fid.toString() === currentUserId.toString()) : false;

    res.status(200).json({
      success: true,
      profile: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        image: user.image,
        banner: user.banner,
        bio: user.bio,
        followersCount: user.followers.length,
        followingCount: user.following.length,
        storiesCount: user.stories.length,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt
      },
      stories,
      stats: {
        totalStories: userStats.totalStories || 0,
        totalViews: userStats.totalViews || 0
      },
      isFollowing,
      followsMe
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req.user as any)._id;
    const { name, username, bio } = req.body;

    const user = await User.findById(userId);
    if (!user) {
       res.status(404).json({ error: 'User not found.' });
       return;
    }

    if (username && username !== user.username) {
      const usernameExists = await User.findOne({ username });
      if (usernameExists) {
         res.status(400).json({ error: 'Username is already taken.' });
         return;
      }
      user.username = username;
    }

    user.name = name || user.name;
    user.bio = bio || user.bio;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        image: user.image,
        banner: user.banner,
        bio: user.bio,
        followersCount: user.followers.length,
        followingCount: user.following.length,
        storiesCount: user.stories.length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfileImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    // Destroy old avatar if customized
    if (user.image?.publicId) {
      try {
        await cloudinary.uploader.destroy(user.image.publicId);
      } catch (err) {
        console.error('Failed to delete old profile image:', err);
      }
    }

    user.image = {
      url: req.file.path,
      filename: req.file.filename,
      publicId: req.file.filename
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile image updated successfully.',
      imageUrl: user.image.url
    });
  } catch (error) {
    next(error);
  }
};

export const updateBannerImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    // Destroy old banner if customized
    if (user.banner?.publicId) {
      try {
        await cloudinary.uploader.destroy(user.banner.publicId);
      } catch (err) {
        console.error('Failed to delete old banner image:', err);
      }
    }

    user.banner = {
      url: req.file.path,
      filename: req.file.filename,
      publicId: req.file.filename
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Banner image updated successfully.',
      bannerUrl: user.banner.url
    });
  } catch (error) {
    next(error);
  }
};

export const toggleFollow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params; // Target user id
    const currentUserId = (req.user as any)._id;

    if (id === currentUserId.toString()) {
       res.status(400).json({ error: 'You cannot follow yourself.' });
       return;
    }

    const targetUser = await User.findById(id);
    const currentUser = await User.findById(currentUserId);

    if (!targetUser || !currentUser) {
       res.status(404).json({ error: 'User not found.' });
       return;
    }

    const alreadyFollowing = currentUser.following.some(fid => fid.toString() === targetUser._id.toString());

    if (alreadyFollowing) {
      // Unfollow
      currentUser.following = currentUser.following.filter(uid => !uid.equals(targetUser._id));
      targetUser.followers = targetUser.followers.filter(uid => !uid.equals(currentUser._id));
    } else {
      // Follow
      currentUser.following.push(targetUser._id as any);
      targetUser.followers.push(currentUser._id as any);

      // Create notification
      targetUser.notifications.push({
        type: 'follow',
        fromUser: currentUser._id as any,
        timeStamp: new Date(),
        read: false
      });

      // Emit socket notification
      const io = req.app.get('io');
      if (io) {
        io.to(targetUser._id.toString()).emit('newNotification', {
          type: 'follow',
          fromUser: {
            _id: currentUser._id,
            username: currentUser.username,
            image: currentUser.image
          }
        });
      }
    }

    await currentUser.save();
    await targetUser.save();

    res.status(200).json({
      success: true,
      isFollowing: !alreadyFollowing,
      followersCount: targetUser.followers.length,
      followingCount: currentUser.following.length,
      message: alreadyFollowing ? 'Unfollowed successfully.' : 'Followed successfully.'
    });
  } catch (error) {
    next(error);
  }
};


export const getFollowers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).populate('followers', 'username name image bio');
    if (!user) {
       res.status(404).json({ error: 'User not found.' });
       return;
    }

    res.status(200).json({
      success: true,
      followers: user.followers
    });
  } catch (error) {
    next(error);
  }
};


export const getFollowing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).populate('following', 'username name image bio');
    if (!user) {
       res.status(404).json({ error: 'User not found.' });
       return;
    }

    res.status(200).json({
      success: true,
      following: user.following
    });
  } catch (error) {
    next(error);
  }
};


export const getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req.user as any)._id;

    const user = await User.findById(userId).populate({
      path: 'notifications.fromUser',
      select: 'username name image'
    });

    if (!user) {
       res.status(404).json({ error: 'User not found.' });
       return;
    }

    // Sort notifications in descending time
    const sortedNotifications = user.notifications.sort((a, b) => b.timeStamp.getTime() - a.timeStamp.getTime());

    // Mark notifications as read
    let needsSave = false;
    user.notifications.forEach(n => {
      if (!n.read) {
        n.read = true;
        needsSave = true;
      }
    });
    if (needsSave) {
      await user.save();
    }

    // Grouping
    const today: any[] = [];
    const yesterday: any[] = [];
    const older: any[] = [];

    const startOfToday = moment().startOf('day');
    const startOfYesterday = moment().subtract(1, 'days').startOf('day');

    sortedNotifications.forEach(notif => {
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
      notifications: {
        today,
        yesterday,
        older
      }
    });
  } catch (error) {
    next(error);
  }
};


export const getUnreadNotificationsCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req.user as any)._id;
    const user = await User.findById(userId);
    if (!user) {
       res.status(404).json({ error: 'User not found.' });
       return;
    }
    const unreadCount = user.notifications.filter(n => !n.read).length;
    res.status(200).json({
      success: true,
      unreadCount
    });
  } catch (error) {
    next(error);
  }
};


export const deleteNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req.user as any)._id;
    const { notifId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
       res.status(404).json({ error: 'User not found.' });
       return;
    }

    user.notifications = user.notifications.filter(n => n._id?.toString() !== notifId);
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Notification deleted.'
    });
  } catch (error) {
    next(error);
  }
};


export const changePassword = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  try {
    const userId = (req.user as any)._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
       res.status(400).json({ error: 'Current password and new password are required.' });
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
      message: 'Password changed successfully.'
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to change password. Make sure current password is correct.' });
  }
};


export const deleteAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req.user as any)._id;

    const user = await User.findById(userId);
    if (!user) {
       res.status(404).json({ error: 'User not found.' });
       return;
    }

    // Clean up images in Cloudinary
    if (user.image?.publicId) {
      try { await cloudinary.uploader.destroy(user.image.publicId); } catch {}
    }
    if (user.banner?.publicId) {
      try { await cloudinary.uploader.destroy(user.banner.publicId); } catch {}
    }

    // Clean up user's stories (Mongoose Story hook handles sub-references)
    const userStories = await Story.find({ owner: userId });
    for (const story of userStories) {
      if (story.image?.publicId) {
        try { await cloudinary.uploader.destroy(story.image.publicId); } catch {}
      }
      await Story.findByIdAndDelete(story._id);
    }

    // Clean up user comments
    await Comment.deleteMany({ author: userId });

    // Delete user document
    await User.findByIdAndDelete(userId);

    // Logout and destroy session
    const expressReq = req as any;
    expressReq.logout((err: any) => {
      if (err) return next(err);
      expressReq.session.destroy((destroyErr: any) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie('connect.sid');
        res.status(200).json({
          success: true,
          message: 'Account deleted successfully.'
        });
      });
    });
  } catch (error) {
    next(error);
  }
};


export const deleteBannerImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req.user as any)._id;
    const user = await User.findById(userId);
    if (!user) {
       res.status(404).json({ error: 'User not found.' });
       return;
    }

    if (user.banner?.publicId) {
      try {
        await cloudinary.uploader.destroy(user.banner.publicId);
      } catch (err) {
        console.error('Failed to destroy banner:', err);
      }
    }

    user.banner = { url: '', filename: '', publicId: '' };
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Cover photo removed successfully.'
    });
  } catch (error) {
    next(error);
  }
};
