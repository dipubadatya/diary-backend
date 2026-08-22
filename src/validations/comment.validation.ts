import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = (fieldName: string) => 
  z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: `Invalid ${fieldName}`
  });

// ============================================
// CREATE COMMENT SCHEMA
// ============================================
export const createCommentSchema = z.object({
  params: z.object({
    storyId: objectIdSchema('story ID')
  }),
  body: z
    .object({
      comment: z
        .string()
        .trim()
        .max(1000, 'Comment must be at most 1000 characters')
        .optional(),
      gif: z
        .string()
        .trim()
        .url('Invalid GIF URL')
        .optional()
        .or(z.literal('')), // allow empty string if not provided
      parentId: z
        .string()
        .refine((val) => !val || mongoose.Types.ObjectId.isValid(val), {
          message: 'Invalid parent comment ID'
        })
        .optional()
        .nullable()
    })
    .refine((data) => (data.comment && data.comment.length > 0) || (data.gif && data.gif.length > 0), {
      message: 'Comment content cannot be empty.',
      path: ['comment']
    })
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// ============================================
// DELETE COMMENT SCHEMA
// ============================================
export const deleteCommentSchema = z.object({
  params: z.object({
    storyId: objectIdSchema('story ID'),
    commentId: objectIdSchema('comment ID')
  })
});

export type DeleteCommentInput = z.infer<typeof deleteCommentSchema>;

// ============================================
// UPDATE COMMENT SCHEMA
// ============================================
export const updateCommentSchema = z.object({
  params: z.object({
    storyId: objectIdSchema('story ID'),
    commentId: objectIdSchema('comment ID')
  }),
  body: z.object({
    comment: z
      .string()
      .trim()
      .min(1, 'Comment content cannot be empty.')
      .max(1000, 'Comment must be at most 1000 characters')
  })
});

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

// ============================================
// LIKE COMMENT SCHEMA
// ============================================
export const likeCommentSchema = z.object({
  params: z.object({
    storyId: objectIdSchema('story ID'),
    commentId: objectIdSchema('comment ID')
  })
});

export type LikeCommentInput = z.infer<typeof likeCommentSchema>;
