import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = (fieldName: string) => 
  z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: `Invalid ${fieldName}`
  });

// ============================================
// GET MESSAGES SCHEMA
// ============================================
export const getMessagesSchema = z.object({
  params: z.object({
    receiverId: objectIdSchema('receiver ID')
  })
});

export type GetMessagesInput = z.infer<typeof getMessagesSchema>;
