import { Request, Response, NextFunction } from 'express';
import Story from '../models/story';
import Comment from '../models/comment';
import User from '../models/user';

export const createComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { storyId } = req.params;
    const { comment, gif, parentId } = req.body;
    const userId = (req.user as any)._id;

    let commentText = comment;
    if ((!commentText || commentText.trim() === '') && gif) {
      commentText = 'Attached GIF';
    }

    if (!commentText || commentText.trim() === '') {
       res.status(400).json({ error: 'Comment content cannot be empty.' });
       return;
    }

    const story = await Story.findById(storyId).populate('owner');
    if (!story) {
       res.status(404).json({ error: 'Story not found.' });
       return;
    }

    // Verify parent comment if parentId is provided
    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (!parentComment) {
        res.status(404).json({ error: 'Parent comment not found.' });
        return;
      }
    }

    const newComment = new Comment({
      comment: commentText,
      gif,
      author: userId,
      parentId: parentId || null
    });

    await newComment.save();
    story.comments.push(newComment._id as any);
    await story.save();

    // Populate the newly created comment first
    const populatedComment = await Comment.findById(newComment._id)
      .populate('author', 'username name image')
      .exec();

    // Notify parent comment author of replies, and notify story owner of comments
    const storyOwner = story.owner as any;
    const io = req.app.get('io');

    // Scenario A: Nested reply notifications
    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (parentComment && parentComment.author) {
        const parentAuthorId = parentComment.author;
        // Notify parent comment author if they are not the reply author
        if (parentAuthorId.toString() !== userId.toString()) {
          try {
            await User.findByIdAndUpdate(parentAuthorId, {
              $push: {
                notifications: {
                  type: 'comment',
                  fromUser: userId,
                  storyId: story._id as any,
                  timeStamp: new Date(),
                  read: false
                }
              }
            });

            if (io) {
              io.to(parentAuthorId.toString()).emit('newNotification', {
                type: 'comment',
                fromUser: {
                  _id: userId,
                  username: (req.user as any).username,
                  image: (req.user as any).image
                },
                storyId: {
                  _id: story._id,
                  title: story.title
                }
              });
            }
          } catch (err) {
            console.error('Failed to send nested reply notification:', err);
          }
        }
      }
    }

    // Scenario B: Main comment notifications (or notifying owner about reply if they aren't the parent author)
    // Avoid double notification if the story owner is the parent author (already notified in Scenario A)
    let isOwnerParentAuthor = false;
    if (parentId && storyOwner) {
      const parentComment = await Comment.findById(parentId);
      if (parentComment && parentComment.author.toString() === storyOwner._id.toString()) {
        isOwnerParentAuthor = true;
      }
    }
    
    if (storyOwner && storyOwner._id.toString() !== userId.toString() && !isOwnerParentAuthor) {
      try {
        await User.findByIdAndUpdate(storyOwner._id, {
          $push: {
            notifications: {
              type: 'comment',
              fromUser: userId,
              storyId: story._id as any,
              timeStamp: new Date(),
              read: false
            }
          }
        });

        // Emit real-time notification to owner
        if (io) {
          io.to(storyOwner._id.toString()).emit('newNotification', {
            type: 'comment',
            fromUser: {
              _id: userId,
              username: (req.user as any).username,
              image: (req.user as any).image
            },
            storyId: {
              _id: story._id,
              title: story.title
            }
          });
        }
      } catch (err) {
        console.error('Failed to send comment notification to owner:', err);
      }
    }

    // Emit socket event to the story room for real-time comment synchronization
    if (io) {
      io.to(`story_${storyId}`).emit('commentCreated', populatedComment);
    }

    res.status(201).json({
      success: true,
      message: 'Comment added successfully.',
      comment: populatedComment
    });
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { storyId, commentId } = req.params;
    const userId = (req.user as any)._id;

    const story = await Story.findById(storyId);
    if (!story) {
       res.status(404).json({ error: 'Story not found.' });
       return;
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
       res.status(404).json({ error: 'Comment not found.' });
       return;
    }

    // Authorize: user must be the comment author OR the story owner
    const isCommentAuthor = comment.author.equals(userId);
    const isStoryOwner = story.owner.equals(userId);

    if (!isCommentAuthor && !isStoryOwner) {
       res.status(403).json({ error: 'You are not authorized to delete this comment.' });
       return;
    }

    // Delete comment and all its replies (if it is a main comment)
    await Comment.findByIdAndDelete(commentId);
    
    let deletedCommentIds = [commentId];
    if (!comment.parentId) {
      // Find and delete all replies to this comment
      const replies = await Comment.find({ parentId: commentId });
      const replyIds = replies.map(r => r._id.toString());
      if (replyIds.length > 0) {
        await Comment.deleteMany({ parentId: commentId });
        deletedCommentIds = [...deletedCommentIds, ...replyIds];
      }
    }

    // Pull deleted comment and its replies from the story comments list
    story.comments = story.comments.filter(c => !deletedCommentIds.includes(c.toString()));
    await story.save();

    // Emit socket event to the story room
    const io = req.app.get('io');
    if (io) {
      io.to(`story_${storyId}`).emit('commentDeleted', { commentId });
    }

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

export const updateComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { storyId, commentId } = req.params;
    const { comment } = req.body;
    const userId = (req.user as any)._id;

    if (!comment || comment.trim() === '') {
      res.status(400).json({ error: 'Comment content cannot be empty.' });
      return;
    }

    const existingComment = await Comment.findById(commentId);
    if (!existingComment) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }

    // Authorize: user must be the comment author
    if (!existingComment.author.equals(userId)) {
      res.status(403).json({ error: 'You are not authorized to edit this comment.' });
      return;
    }

    existingComment.comment = comment;
    existingComment.editedAt = new Date();
    await existingComment.save();

    const populatedComment = await Comment.findById(commentId)
      .populate('author', 'username name image')
      .exec();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`story_${storyId}`).emit('commentUpdated', populatedComment);
    }

    res.status(200).json({
      success: true,
      message: 'Comment updated successfully.',
      comment: populatedComment
    });
  } catch (error) {
    next(error);
  }
};

export const likeComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { storyId, commentId } = req.params;
    const userId = (req.user as any)._id;

    const story = await Story.findById(storyId);
    if (!story) {
      res.status(404).json({ error: 'Story not found.' });
      return;
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }

    if (!comment.likes) {
      comment.likes = [];
    }

    const hasLiked = comment.likes.some(id => id.toString() === userId.toString());
    let liked = false;

    if (!hasLiked) {
      comment.likes.push(userId);
      comment.likesCount = (comment.likesCount || 0) + 1;
      liked = true;
    } else {
      comment.likes = comment.likes.filter(id => id.toString() !== userId.toString()) as any;
      comment.likesCount = Math.max(0, (comment.likesCount || 0) - 1);
    }

    await comment.save();

    // Notify comment author if they are not the liking user
    if (liked && comment.author.toString() !== userId.toString()) {
      try {
        await User.findByIdAndUpdate(comment.author, {
          $push: {
            notifications: {
              type: 'like',
              fromUser: userId,
              storyId: story._id as any,
              timeStamp: new Date(),
              read: false
            }
          }
        });

        // Emit notification
        const io = req.app.get('io');
        if (io) {
          io.to(comment.author.toString()).emit('newNotification', {
            type: 'like',
            fromUser: {
              _id: userId,
              username: (req.user as any).username,
              image: (req.user as any).image
            },
            storyId: {
              _id: story._id,
              title: story.title
            }
          });
        }
      } catch (err) {
        console.error('Failed to send comment like notification:', err);
      }
    }

    // Emit socket event to sync likes
    const io = req.app.get('io');
    if (io) {
      io.to(`story_${storyId}`).emit('commentLiked', {
        commentId,
        likesCount: comment.likesCount,
        likes: comment.likes
      });
    }

    res.status(200).json({
      success: true,
      liked,
      likesCount: comment.likesCount,
      likes: comment.likes
    });
  } catch (error) {
    next(error);
  }
};
