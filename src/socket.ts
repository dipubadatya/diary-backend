import { Server, Socket } from 'socket.io';
import User from './models/user';
import Message from './models/message';

export default (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('🔌 A user connected:', socket.id);

    // Track rooms user joins (typically their own user ID)
    let authenticatedUserId: string | null = null;

    socket.on('authenticate', async (userId: string) => {
      if (!userId) return;
      authenticatedUserId = userId;
      socket.join(userId);
      console.log(`👤 User ${userId} authenticated and joined room`);

      try {
        await User.findByIdAndUpdate(userId, {
          isOnline: true,
          lastSeen: new Date()
        });

        io.emit('userStatus', {
          userId,
          isOnline: true,
          lastSeen: new Date()
        });
      } catch (err) {
        console.error('Error authenticating socket:', err);
      }
    });

    socket.on('sendMessage', async ({ sender, receiver, message }: { sender: string; receiver: string; message: string }) => {
      try {
        const newMessage = new Message({
          sender,
          receiver,
          message,
          status: 'sent'
        });

        const savedMessage = await newMessage.save();

        // Check if receiver room is active (online check)
        const receiverRoom = io.sockets.adapter.rooms.get(receiver);
        const isReceiverOnline = receiverRoom && receiverRoom.size > 0;

        if (isReceiverOnline) {
          savedMessage.status = 'delivered';
          await savedMessage.save();
        }

        const messageData = savedMessage.toObject();

        // Send to both sender and receiver rooms
        io.to(sender).to(receiver).emit('newMessage', messageData);
      } catch (error) {
        console.error('Error handling sendMessage socket event:', error);
      }
    });

    socket.on('typing', ({ sender, receiver, username }: { sender: string; receiver: string; username: string }) => {
      socket.to(receiver).emit('typing', { sender, username });
    });

    socket.on('stopTyping', ({ sender, receiver }: { sender: string; receiver: string }) => {
      socket.to(receiver).emit('stopTyping', { sender });
    });

    socket.on('markAsSeen', async ({ sender, receiver }: { sender: string; receiver: string }) => {
      try {
        await Message.updateMany(
          { sender, receiver, status: { $ne: 'seen' } },
          { $set: { status: 'seen', seenAt: new Date() } }
        );

        io.to(sender).emit('messagesSeen', { receiver });
        io.to(receiver).emit('messagesSeen', { sender });
      } catch (error) {
        console.error('Error marking messages as seen via socket:', error);
      }
    });

    socket.on('disconnect', async () => {
      console.log('🔌 User disconnected:', socket.id);
      if (authenticatedUserId) {
        try {
          await User.findByIdAndUpdate(authenticatedUserId, {
            isOnline: false,
            lastSeen: new Date()
          });

          io.emit('userStatus', {
            userId: authenticatedUserId,
            isOnline: false,
            lastSeen: new Date()
          });
        } catch (err) {
          console.error('Error updating user offline status on disconnect:', err);
        }
      }
    });
  });
};
