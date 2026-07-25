import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Message from '../models/message';

export const getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { receiverId } = req.params;
    const currentUserId = (req.user as any)._id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
       res.status(400).json({ error: 'Invalid receiver ID.' });
       return;
    }

    const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

    // Fetch messages between sender and receiver
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: receiverObjectId },
        { sender: receiverObjectId, receiver: currentUserId }
      ]
    }).sort({ timeStamp: 1 });

    // Mark received messages as seen
    const unreadReceivedMessages = messages.filter(
      msg => msg.sender.equals(receiverObjectId) && msg.status !== 'seen'
    );

    if (unreadReceivedMessages.length > 0) {
      await Message.updateMany(
        {
          sender: receiverObjectId,
          receiver: currentUserId,
          status: { $ne: 'seen' }
        },
        {
          $set: { status: 'seen', seenAt: new Date() }
        }
      );

      // Emit read status update to sender
      const io = req.app.get('io');
      if (io) {
        io.to(receiverId).emit('messagesSeen', { sender: currentUserId });
      }
    }

    res.status(200).json({
      success: true,
      messages
    });
  } catch (error) {
    next(error);
  }
};

export const getConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUserId = (req.user as any)._id;

    // Aggregate messages to find unique conversation partners
    const conversationPartners = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: currentUserId },
            { receiver: currentUserId }
          ]
        }
      },
      {
        $sort: { timeStamp: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', currentUserId] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$message' },
          lastMessageTime: { $first: '$timeStamp' },
          lastMessageSender: { $first: '$sender' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', currentUserId] },
                    { $ne: ['$status', 'seen'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      {
        $unwind: '$userDetails'
      },
      {
        $project: {
          _id: 1,
          lastMessage: 1,
          lastMessageTime: 1,
          lastMessageSender: 1,
          unreadCount: 1,
          user: {
            _id: '$userDetails._id',
            name: '$userDetails.name',
            username: '$userDetails.username',
            image: '$userDetails.image',
            isOnline: '$userDetails.isOnline',
            lastSeen: '$userDetails.lastSeen'
          }
        }
      },
      {
        $sort: { lastMessageTime: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      conversations: conversationPartners
    });
  } catch (error) {
    next(error);
  }
};
