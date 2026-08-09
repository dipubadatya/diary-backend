import mongoose, { Schema, Document } from 'mongoose';

export interface IComment extends Document {
  comment: string;
  gif?: string;
  author: mongoose.Types.ObjectId;
  timeStamp: Date;
  parentId?: mongoose.Types.ObjectId | null;
  likes: mongoose.Types.ObjectId[];
  likesCount: number;
  editedAt?: Date;
}

const commentSchema = new Schema<IComment>({
  comment: {
    type: String,
    required: true
  },
  gif: {
    type: String
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timeStamp: {
    type: Date,
    default: Date.now
  },
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  likes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  likesCount: {
    type: Number,
    default: 0
  },
  editedAt: {
    type: Date
  }
});

// Remove comment reference from story when comment is deleted
commentSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    await mongoose.model('Story').updateOne(
      { comments: doc._id },
      { $pull: { comments: doc._id } }
    );
  }
});

const Comment = mongoose.model<IComment>('Comment', commentSchema);
export default Comment;
