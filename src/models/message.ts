import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  sender: mongoose.Types.ObjectId;
  receiver: mongoose.Types.ObjectId;
  message: string;
  status: 'sent' | 'delivered' | 'seen';
  seenAt?: Date;
  timeStamp: Date;
}

const messageSchema = new Schema<IMessage>({
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'seen'],
    default: 'sent'
  },
  seenAt: {
    type: Date
  },
  timeStamp: {
    type: Date,
    default: Date.now
  }
});

const Message = mongoose.model<IMessage>('Message', messageSchema);
export default Message;
