
import { Request, Response, NextFunction } from "express";
import User from "../models/user";
import Story from "../models/story";
import Comment from "../models/comment";
import { cloudinary } from "../config/cloudinary";
import moment from "moment";
import mongoose from "mongoose";

// ─────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────

const isValidObjectId = (id: string): boolean =>
  mongoose.Types.ObjectId.isValid(id);

const sanitizeString = (str: string, maxLength: number): string =>
  str?.toString().trim().slice(0, maxLength) || "";

const escapeRegex = (string: string): string =>
  string.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");

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
// PROFILE - GET, UPDATE, IMAGE, BANNER
// ─────────────────────────────────────────────

export const getUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { username } = req.params;
    const currentUserId = req.user ? (req.user as any)._id : null;

    if (!username || username.trim() === "") {
      res.status(400).json({ error: "Username or ID is required." });
      return;
    }

    const query =
      isValidObjectId(username) && username.length === 24
        ? { _id: username }
        : { username: username.trim() };

    const user = await User.findOne(query).select(
      "-salt -hash -verificationToken -verificationTokenExpires " +
        "-resetPasswordToken -resetPasswordExpires -__v",
    );

    if (!user) {
      res.status(404).json({ error: "User not found." });
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
            _id: "$owner",
            totalStories: { $sum: 1 },
            totalViews: {
              $sum: { $size: { $ifNull: ["$views", []] } },
            },
          },
        },
      ]),
      Story.find({ owner: user._id })
        .sort({ timeStamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate("owner", "username name image")
        .lean(),
      Story.countDocuments({ owner: user._id }),
    ]);

    const userStats =
      stats.length > 0 ? stats[0] : { totalStories: 0, totalViews: 0 };

    const isFollowing = currentUserId
      ? user.followers.some(
          (fid: any) => fid.toString() === currentUserId.toString(),
        )
      : false;

    const followsMe = currentUserId
      ? user.following.some(
          (fid: any) => fid.toString() === currentUserId.toString(),
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

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;
    const { name, username, bio } = req.body;

    if (!name && !username && !bio) {
      res.status(400).json({ error: "At least one field is required to update." });
      return;
    }

    const sanitizedName = name ? sanitizeString(name, 50) : undefined;
    const sanitizedUsername = username ? sanitizeString(username, 30) : undefined;
    const sanitizedBio = bio !== undefined ? sanitizeString(bio, 300) : undefined;

    if (sanitizedUsername && !/^[a-zA-Z0-9_]+$/.test(sanitizedUsername)) {
      res.status(400).json({
        error: "Username can only contain letters, numbers, and underscores.",
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    if (sanitizedUsername && sanitizedUsername !== user.username) {
      const usernameExists = await User.findOne({
        username: sanitizedUsername,
        _id: { $ne: userId },
      });

      if (usernameExists) {
        res.status(409).json({ error: "Username is already taken." });
        return;
      }

      user.username = sanitizedUsername;
    }

    if (sanitizedName) user.name = sanitizedName;
    if (sanitizedBio !== undefined) user.bio = sanitizedBio;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: buildUserProfileResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfileImage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;

    if (!req.file) {
      res.status(400).json({ error: "Image file is required." });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const oldPublicId = user.image?.publicId;

    user.image = {
      url: req.file.path,
      filename: req.file.filename,
      publicId: req.file.filename,
    };

    await user.save();

    // Delete old image from Cloudinary after the new one is saved
    if (oldPublicId) {
      cloudinary.uploader
        .destroy(oldPublicId)
        .catch((err) => console.error("Failed to delete old profile image:", err));
    }

    res.status(200).json({
      success: true,
      message: "Profile image updated successfully.",
      image: user.image,
    });
  } catch (error) {
    // If save fails, remove the newly uploaded file from Cloudinary
    if (req.file?.filename) {
      cloudinary.uploader
        .destroy(req.file.filename)
        .catch((err) => console.error("Cloudinary cleanup failed:", err));
    }
    next(error);
  }
};

export const updateBannerImage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;

    if (!req.file) {
      res.status(400).json({ error: "Banner image file is required." });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const oldPublicId = user.banner?.publicId;

    user.banner = {
      url: req.file.path,
      filename: req.file.filename,
      publicId: req.file.filename,
    };

    await user.save();

    // Delete old banner from Cloudinary after the new one is saved
    if (oldPublicId) {
      cloudinary.uploader
        .destroy(oldPublicId)
        .catch((err) => console.error("Failed to delete old banner image:", err));
    }

    res.status(200).json({
      success: true,
      message: "Banner image updated successfully.",
      banner: user.banner,
    });
  } catch (error) {
    // If save fails, remove the newly uploaded file from Cloudinary
    if (req.file?.filename) {
      cloudinary.uploader
        .destroy(req.file.filename)
        .catch((err) => console.error("Cloudinary cleanup failed:", err));
    }
    next(error);
  }
};

export const deleteBannerImage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    if (!user.banner?.publicId) {
      res.status(400).json({ error: "No banner image to remove." });
      return;
    }

    const oldPublicId = user.banner.publicId;

    // Clear banner in DB first, then remove from Cloudinary
    user.banner = { url: "", filename: "", publicId: "" };
    await user.save();

    cloudinary.uploader
      .destroy(oldPublicId)
      .catch((err) => console.error("Failed to destroy banner from Cloudinary:", err));

    res.status(200).json({
      success: true,
      message: "Cover photo removed successfully.",
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// FOLLOW - TOGGLE, FOLLOWERS LIST, FOLLOWING LIST
// ─────────────────────────────────────────────

export const toggleFollow = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUserId = (req.user as any)._id;

    if (!isValidObjectId(id)) {
      res.status(400).json({ error: "Invalid user ID." });
      return;
    }

    if (id === currentUserId.toString()) {
      res.status(400).json({ error: "You cannot follow yourself." });
      return;
    }

    const [targetUser, currentUser] = await Promise.all([
      User.findById(id),
      User.findById(currentUserId),
    ]);

    if (!targetUser || !currentUser) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const alreadyFollowing = currentUser.following.some(
      (fid: any) => fid.toString() === targetUser._id.toString(),
    );

    if (alreadyFollowing) {
      // Remove from both users' lists
      await Promise.all([
        User.findByIdAndUpdate(currentUserId, {
          $pull: { following: targetUser._id },
        }),
        User.findByIdAndUpdate(targetUser._id, {
          $pull: { followers: currentUser._id },
        }),
      ]);
    } else {
      // Add to both users' lists
      await Promise.all([
        User.findByIdAndUpdate(currentUserId, {
          $addToSet: { following: targetUser._id },
        }),
        User.findByIdAndUpdate(targetUser._id, {
          $addToSet: { followers: currentUser._id },
        }),
      ]);

      // Only send a follow notification if one has not been sent before
      const alreadyNotified = targetUser.notifications.some(
        (n: any) =>
          n.type === "follow" &&
          n.fromUser?.toString() === currentUser._id.toString(),
      );

      if (!alreadyNotified) {
        await User.findByIdAndUpdate(targetUser._id, {
          $push: {
            notifications: {
              type: "follow",
              fromUser: currentUser._id,
              timeStamp: new Date(),
              read: false,
            },
          },
        });

        const io = req.app.get("io");
        if (io) {
          io.to(targetUser._id.toString()).emit("newNotification", {
            type: "follow",
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

    // Fetch updated counts after the operation
    const [updatedTarget, updatedCurrent] = await Promise.all([
      User.findById(targetUser._id).select("followers"),
      User.findById(currentUserId).select("following"),
    ]);

    res.status(200).json({
      success: true,
      isFollowing: !alreadyFollowing,
      followersCount: updatedTarget?.followers?.length ?? 0,
      followingCount: updatedCurrent?.following?.length ?? 0,
      message: alreadyFollowing ? "Unfollowed successfully." : "Followed successfully.",
    });
  } catch (error) {
    next(error);
  }
};

export const getFollowers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ error: "Invalid user ID." });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;

    const user = await User.findById(id).select("followers");
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const total = user.followers.length;

    // Slice the IDs first, then fetch only those users (correct pagination approach)
    const paginatedIds = user.followers.slice(skip, skip + limit);

    const followers = await User.find({ _id: { $in: paginatedIds } })
      .select("username name image bio")
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

export const getFollowing = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ error: "Invalid user ID." });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;

    const user = await User.findById(id).select("following");
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const total = user.following.length;

    // Slice the IDs first, then fetch only those users (correct pagination approach)
    const paginatedIds = user.following.slice(skip, skip + limit);

    const following = await User.find({ _id: { $in: paginatedIds } })
      .select("username name image bio")
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
// NOTIFICATIONS - GET, UNREAD COUNT, DELETE
// ─────────────────────────────────────────────

export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;

    const user = await User.findById(userId).populate({
      path: "notifications.fromUser",
      select: "username name image",
    });

    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    // Sort notifications newest first
    const sortedNotifications = [...user.notifications].sort(
      (a: any, b: any) =>
        new Date(b.timeStamp).getTime() - new Date(a.timeStamp).getTime(),
    );

    // Mark all unread notifications as read in the background
    const hasUnread = user.notifications.some((n: any) => !n.read);
    if (hasUnread) {
      User.updateMany(
        { _id: userId, "notifications.read": false },
        { $set: { "notifications.$[elem].read": true } },
        { arrayFilters: [{ "elem.read": false }] },
      ).catch((err) => console.error("Failed to mark notifications as read:", err));
    }

    // Group notifications by date
    const today: any[] = [];
    const yesterday: any[] = [];
    const older: any[] = [];

    const startOfToday = moment().startOf("day");
    const startOfYesterday = moment().subtract(1, "days").startOf("day");

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

export const getUnreadNotificationsCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;

    // Use aggregation to count unread notifications without loading the full document
    const result = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(userId.toString()) } },
      { $unwind: "$notifications" },
      { $match: { "notifications.read": false } },
      { $count: "unreadCount" },
    ]);

    const unreadCount = result.length > 0 ? result[0].unreadCount : 0;

    res.status(200).json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;
    const { notifId } = req.params;

    if (!isValidObjectId(notifId)) {
      res.status(400).json({ error: "Invalid notification ID." });
      return;
    }

    // Pull the notification only if it belongs to this user
    const result = await User.findByIdAndUpdate(
      userId,
      { $pull: { notifications: { _id: new mongoose.Types.ObjectId(notifId) } } },
      { new: true },
    );

    if (!result) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted.",
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// ACCOUNT - CHANGE PASSWORD, DELETE ACCOUNT
// ─────────────────────────────────────────────

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Current password and new password are required." });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters long." });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({
        error: "New password must be different from the current password.",
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      res.status(400).json({ error: "Current password is incorrect." });
      return;
    }

    // The pre-save hook on the model will hash the new password automatically
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    next(error);
  }
};

export const deleteAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    // Collect story images for Cloudinary cleanup
    const userStories = await Story.find({ owner: userId }).select("image");

    const cloudinaryIds: string[] = [];
    if (user.image?.publicId) cloudinaryIds.push(user.image.publicId);
    if (user.banner?.publicId) cloudinaryIds.push(user.banner.publicId);
    userStories.forEach((story: any) => {
      if (story.image?.publicId) cloudinaryIds.push(story.image.publicId);
    });

    // Delete all user data from the database in parallel
    await Promise.all([
      Story.deleteMany({ owner: userId }),
      Comment.deleteMany({ author: userId }),
      User.updateMany({ followers: userId }, { $pull: { followers: userId } }),
      User.updateMany({ following: userId }, { $pull: { following: userId } }),
      User.findByIdAndDelete(userId),
    ]);

    // Remove all Cloudinary assets after DB cleanup
    if (cloudinaryIds.length > 0) {
      Promise.all(
        cloudinaryIds.map((pid) =>
          cloudinary.uploader
            .destroy(pid)
            .catch((err) => console.error(`Cloudinary delete failed for ${pid}:`, err)),
        ),
      ).catch(() => {});
    }

    // Log the user out and destroy their session
    const expressReq = req as any;
    expressReq.logout((err: any) => {
      if (err) return next(err);
      expressReq.session.destroy((destroyErr: any) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie("connect.sid");
        res.status(200).json({
          success: true,
          message: "Account deleted successfully.",
        });
      });
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// SEARCH - SEARCH WRITERS, RECENT SEARCHES
// ─────────────────────────────────────────────

export const searchWriters = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = req.query.q ? (req.query.q as string).trim() : "";
    const currentUserId = req.user ? (req.user as any)._id : null;

    // If no search query, return the user's recent searches instead
    if (!q) {
      if (currentUserId) {
        const user = await User.findById(currentUserId).populate({
          path: "recentSearches",
          select: "username name image followers following",
        });

        if (!user) {
          res.status(200).json({ success: true, results: [] });
          return;
        }

        const results = (user.recentSearches || [])
          .filter(Boolean)
          .map((u: any) => {
            const isFollowing = currentUserId
              ? u.followers?.some(
                  (fid: any) => fid.toString() === currentUserId.toString(),
                )
              : false;

            const followsMe = currentUserId
              ? u.following?.some(
                  (fid: any) => fid.toString() === currentUserId.toString(),
                )
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

    const searchRegex = new RegExp(escapeRegex(q), "i");

    const matchingUsers = await User.find({
      $or: [{ username: searchRegex }, { name: searchRegex }],
    })
      .select("username name image followers following")
      .limit(50)
      .lean();

    // Score results so the most relevant ones appear first
    const scoredUsers = matchingUsers.map((user: any) => {
      const lowerQ = q.toLowerCase();
      const lowerUsername = (user.username || "").toLowerCase();
      const lowerName = (user.name || "").toLowerCase();

      let textScore = 0;
      if (lowerUsername === lowerQ || lowerName === lowerQ) {
        textScore = 1000; // Exact match
      } else if (lowerUsername.startsWith(lowerQ) || lowerName.startsWith(lowerQ)) {
        textScore = 500; // Starts with query
      } else {
        textScore = 100; // Partial match
      }

      let relationshipScore = 0;
      let isFollowing = false;
      let followsMe = false;

      if (currentUserId) {
        isFollowing =
          user.followers?.some(
            (fid: any) => fid.toString() === currentUserId.toString(),
          ) ?? false;

        followsMe =
          user.following?.some(
            (fid: any) => fid.toString() === currentUserId.toString(),
          ) ?? false;

        if (isFollowing) relationshipScore += 20;
        if (followsMe) relationshipScore += 10;
        if (isFollowing && followsMe) relationshipScore += 15;
      }

      return {
        user,
        score: textScore + relationshipScore,
        followersCount: user.followers?.length ?? 0,
        isFollowing,
        followsMe,
      };
    });

    // Sort by score first, then by follower count as a tiebreaker
    scoredUsers.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
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
  next: NextFunction,
): Promise<void> => {
  try {
    const { writerId } = req.body;
    const currentUserId = (req.user as any)._id;

    if (!writerId || !isValidObjectId(writerId)) {
      res.status(400).json({ error: "Invalid writer ID." });
      return;
    }

    const writer = await User.findById(writerId);
    if (!writer) {
      res.status(404).json({ error: "Writer not found." });
      return;
    }

    const user = await User.findById(currentUserId);
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    if (!user.recentSearches) user.recentSearches = [];

    // Remove the writer if they already exist, then add them to the front
    user.recentSearches = user.recentSearches.filter(
      (id) => id.toString() !== writerId.toString(),
    );
    user.recentSearches.unshift(new mongoose.Types.ObjectId(writerId));

    // Keep only the 10 most recent searches
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
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUserId = (req.user as any)._id;

    if (!id || !isValidObjectId(id)) {
      res.status(400).json({ error: "Invalid writer ID." });
      return;
    }

    const user = await User.findById(currentUserId);
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    if (user.recentSearches) {
      user.recentSearches = user.recentSearches.filter(
        (rid) => rid.toString() !== id.toString(),
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
  next: NextFunction,
): Promise<void> => {
  try {
    const currentUserId = (req.user as any)._id;

    const user = await User.findById(currentUserId);
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    user.recentSearches = [];
    await user.save();

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// UTILITY - CHECK IF USERNAME IS TAKEN
// ─────────────────────────────────────────────

export const existingUsername = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { username } = req.params;
    const trimmedUsername = username?.trim();

    if (!trimmedUsername) {
      res.status(400).json({ error: "Username is required." });
      return;
    }

    const existingUser = await User.findOne({ username: trimmedUsername })
      .select("_id")
      .lean();

    res.status(200).json({ taken: !!existingUser });
  } catch (error) {
    next(error);
  }
};