import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface INotification {
  _id?: mongoose.Types.ObjectId;
  type: 'like' | 'follow' | 'comment';
  fromUser: mongoose.Types.ObjectId;
  storyId?: mongoose.Types.ObjectId | null;
  timeStamp: Date;
  read: boolean;
}


export interface IUser extends Document {
  name: string;
  username: string;
  email: string;
  password?: string;
  provider?: string;
  googleId?: string;
  avatar?: string;
  emailVerified?: boolean;
  comparePassword(candidatePassword: string): Promise<boolean>;
  image: {
    url: string;
    filename: string;
    publicId?: string;
  };
  banner: {
    url: string;
    filename: string;
    publicId?: string;
  };
  bio?: string;
  stories: mongoose.Types.ObjectId[];
  followers: mongoose.Types.ObjectId[];
  following: mongoose.Types.ObjectId[];
  recentSearches: mongoose.Types.ObjectId[];
  isOnline: boolean;
  lastSeen: Date;
  notifications: INotification[];
  isVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserModel extends Model<IUser> {
  cleanupUnverifiedUsers(): Promise<any>;
}

const notificationSchema = new Schema<INotification>({
  type: {
    type: String,
    enum: ['like', 'follow', 'comment'],
    required: true
  },
  fromUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  storyId: { type: Schema.Types.ObjectId, ref: 'Story', default: null },
  timeStamp: {
    type: Date,
    default: Date.now
  },
  read: { type: Boolean, default: false }
});

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: function(this: any) {
      return !this.provider || this.provider === 'local';
    }
  },
  provider: {
    type: String,
    default: 'local'
  },
  googleId: {
    type: String
  },
  avatar: {
    type: String
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  image: {
    url: {
      type: String,
      default: "https://media.istockphoto.com/id/1300845620/vector/user-icon-flat-isolated-on-white-background-user-symbol-vector-illustration.jpg?s=612x612&w=0&k=20&c=yBeyba0hUkh14_jgv1OKqIH0CCSWU_4ckRkAoy2p73o="
    },
    filename: {
      type: String,
      default: 'profile_image'
    },
    publicId: {
      type: String
    }
  },
  banner: {
    url: {
      type: String,
      default: 'https://i.pinimg.com/736x/7c/05/b9/7c05b92ca71023ebde50496547407ac5.jpg'
    },
    filename: {
      type: String,
      default: 'profile_image'
    },
    publicId: {
      type: String
    }
  },
  bio: {
    type: String
  },
  stories: [{
    type: Schema.Types.ObjectId,
    ref: "Story"
  }],
  followers: [{
    type: Schema.Types.ObjectId,
    ref: "User"
  }],
  following: [{
    type: Schema.Types.ObjectId,
    ref: "User"
  }],
  recentSearches: [{
    type: Schema.Types.ObjectId,
    ref: "User"
  }],
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  notifications: [notificationSchema],
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, {
  timestamps: true
});

// Pre-save hook to check for duplicate email and hash password
userSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password as string, salt);
    } catch (err: any) {
      return next(err);
    }
  }

  if (this.isModified('email')) {
    const existingUser = await mongoose.model('User').findOne({ email: this.email });
    if (existingUser && !existingUser._id.equals(this._id)) {
      return next(new Error('Email already in use'));
    }
  }
  next();
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Static method to cleanup old unverified users
userSchema.statics.cleanupUnverifiedUsers = async function () {
  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
    const result = await this.deleteMany({
      isVerified: false,
      createdAt: { $lt: cutoff }
    });
    console.log(`Cleaned up ${result.deletedCount} unverified users`);
    return result;
  } catch (err) {
    console.error('Error in cleanupUnverifiedUsers:', err);
    throw err;
  }
};

// We export the model using IUserModel to include our custom static methods
const User = mongoose.model<IUser, IUserModel>('User', userSchema);

// Setup cleanup interval (run every 5 minutes)
const cleanupInterval = setInterval(async () => {
  try {
    await User.cleanupUnverifiedUsers();
  } catch (err) {
    console.error('Error in cleanup interval:', err);
  }
}, 5 * 60 * 1000);

process.on('SIGINT', () => {
  clearInterval(cleanupInterval);
});

export default User;
