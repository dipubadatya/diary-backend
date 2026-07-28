import { Request, Response, NextFunction } from 'express';
import Story from '../models/story';
import Comment from '../models/comment';


export const createComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { storyId } = req.params;
    const { comment, gif } = req.body;
    const userId = (req.user as any)._id;

    if (!comment || comment.trim() === '') {
       res.status(400).json({ error: 'Comment content cannot be empty.' });
       return;
    }

    const story = await Story.findById(storyId).populate('owner');
    if (!story) {
       res.status(404).json({ error: 'Story not found.' });
       return;
    }

    const newComment = new Comment({
      comment,
      gif,
      author: userId
    });

    await newComment.save();
    story.comments.push(newComment._id as any);
    await story.save();

    // Notify story owner if comment author is different
    const storyOwner = story.owner as any;
    if (storyOwner && !storyOwner._id.equals(userId)) {
      storyOwner.notifications.push({
        type: 'comment',
        fromUser: userId,
        storyId: story._id as any,
        timeStamp: new Date(),
        read: false
      });
      await storyOwner.save();

      // Emit real-time notification
      const io = req.app.get('io');
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
    }

    const populatedComment = await Comment.findById(newComment._id)
      .populate('author', 'username name image')
      .exec();

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

    await Comment.findByIdAndDelete(commentId);

    // Pull from story comments list (handled by mongoose post hook, but let's ensure consistency)
    story.comments = story.comments.filter(c => !c.equals(commentId));
    await story.save();

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};
