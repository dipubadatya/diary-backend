import mongoose, { Schema, Document } from 'mongoose';

export interface IStory extends Document {
  title: string;
  image: {
    url: string;
    filename: string;
    publicId?: string;
  };
  story: string; // HTML content from TinyMCE editor
  timeStamp: Date;
  editedAt?: Date;
  category: 'fantasy' | 'random-thoughts' | 'poetry' | 'letter' | 'mystery' | 'adventure' | 'historical' | 'fiction' | 'other';
  owner: mongoose.Types.ObjectId;
  likedBy: mongoose.Types.ObjectId[];
  likesCounts: number;
  views: mongoose.Types.ObjectId[];
  comments: mongoose.Types.ObjectId[];
}

const storySchema = new Schema<IStory>({
  title: {
    type: String,
    required: true
  },
  image: {
    url: { type: String, required: true },
    filename: { type: String, required: true },
    publicId: { type: String }
  },
  story: {
    type: String,
    required: true
  },
  timeStamp: {
    type: Date,
    default: Date.now
  },
  editedAt: {
    type: Date
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
      'other'
    ],
    required: true
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  likedBy: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  likesCounts: {
    type: Number,
    default: 0
  },
  views: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    type: Schema.Types.ObjectId,
    ref: 'Comment'
  }]
});

// Middleware to clean up references when a story is deleted
storySchema.post('findOneAndDelete', async function (story) {
  if (story) {
    // Remove from owner's stories list
    await mongoose.model('User').updateOne(
      { _id: story.owner },
      { $pull: { stories: story._id } }
    );

    // Delete associated comments
    await mongoose.model('Comment').deleteMany({
      _id: { $in: story.comments }
    });
  }
});

const Story = mongoose.model<IStory>('Story', storySchema);
export default Story;
