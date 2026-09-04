import mongoose, { Schema, Document, Types } from 'mongoose';

// ------------------------------------------------------------------
// Interface Definition
// ------------------------------------------------------------------

export interface IStory extends Document {
  title: string;
  image: {
    url: string;
    filename: string;
    publicId?: string;
  };
  story: string; 
  timeStamp: Date;
  editedAt?: Date;
  category: 
    | 'fantasy'
    | 'random-thoughts'
    | 'poetry'
    | 'letter'
    | 'mystery'
    | 'adventure'
    | 'historical'
    | 'fiction'
    | 'other';
  owner: Types.ObjectId;
  likedBy: Types.ObjectId[];
  likesCounts: number;
  views: Types.ObjectId[];
  comments: Types.ObjectId[];
}

// ------------------------------------------------------------------
// Schema Design
// ------------------------------------------------------------------

const storySchema = new Schema<IStory>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      url: { 
        type: String, 
        required: true 
      },
      filename: { 
        type: String, 
        required: true 
      },
      publicId: { 
        type: String 
      },
    },
    story: {
      type: String,
      required: true,
      trim: true,
    },
    timeStamp: {
      type: Date,
      default: Date.now,
    },
    editedAt: {
      type: Date,
    },
    category: {
      type: String,
      enum: [
        'fantasy',
        'random-thoughts',
        'poetry',
        'letter',
        'mystery',
        'adventure',
        'historical',
        'fiction',
        'other',
      ],
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    likedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    likesCounts: {
      type: Number,
      default: 0,
    },
    views: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    comments: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Comment',
      },
    ],
  },
  {
    // Automatically creates virtuals and clean JSON conversions when fetched
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ------------------------------------------------------------------
// Database Indexing (Crucial for Speed and Performance)
// ------------------------------------------------------------------

// High speed lookup for a user's diary feed (Sorted newest first)
storySchema.index({ owner: 1, timeStamp: -1 });

// Speed up sorting/filtering by category and date
storySchema.index({ category: 1, timeStamp: -1 });

// Allows full-text search capability inside stories and titles
storySchema.index({ title: 'text', story: 'text' });

// ------------------------------------------------------------------
// Cascade Delete Middleware
// ------------------------------------------------------------------

storySchema.post('findOneAndDelete', async function (story) {
  if (story) {
    try {
      // Pull this story reference out of the author's list of stories
      await mongoose.model('User').updateOne(
        { _id: story.owner },
        { $pull: { stories: story._id } }
      );

      // Delete all comments that were attached to this deleted story
      if (story.comments && story.comments.length > 0) {
        await mongoose.model('Comment').deleteMany({
          _id: { $in: story.comments },
        });
      }
    } catch (error) {
      console.error('Error during story cascade delete cleanup:', error);
    }
  }
});

// ------------------------------------------------------------------
// Export Model
// ------------------------------------------------------------------

const Story = mongoose.model<IStory>('Story', storySchema);
export default Story;