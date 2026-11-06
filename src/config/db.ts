import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const dbUrl = process.env.MONGO_ATLAS;
    if (!dbUrl) {
      throw new Error('MONGO_ATLAS environment variable is not defined');
    }
    await mongoose.connect(dbUrl);
    console.log('[DB] MongoDB connected');

  } catch (err) {
    console.error('[DB] MongoDB connection error:', err);
    process.exit(1);
  }
};
