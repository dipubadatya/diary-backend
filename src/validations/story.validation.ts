import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = (fieldName: string) =>
  z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: `Invalid ${fieldName}`
  });

const categoryEnum = z.enum(
  [
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
  {
    message: 'Invalid category selected'
  }
);

// ============================================
// GET STORIES SCHEMA
// ============================================
export const getStoriesSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    category: z.string().trim().optional(),
    sort: z.enum(['best', 'newest', 'oldest']).optional(),
    page: z.string().regex(/^\d+$/, 'Page must be a number').optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a number').optional()
  })
});

export type GetStoriesInput = z.infer<typeof getStoriesSchema>;

// ============================================
// GET STORY BY ID SCHEMA
// ============================================
export const getStoryByIdSchema = z.object({
  params: z.object({
    id: objectIdSchema('story ID')
  })
});

export type GetStoryByIdInput = z.infer<typeof getStoryByIdSchema>;

// ============================================
// CREATE STORY SCHEMA
// ============================================
export const createStorySchema = z.object({
  body: z.object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .min(3, 'Title must be at least 3 characters')
      .max(100, 'Title must be at most 100 characters'),
    story: z
      .string()
      .trim()
      .min(1, 'Story content is required')
      .max(50000, 'Story content cannot exceed 50,000 characters'),
    category: categoryEnum
  })
});

export type CreateStoryInput = z.infer<typeof createStorySchema>;

// ============================================
// UPDATE STORY SCHEMA
// ============================================
export const updateStorySchema = z.object({
  params: z.object({
    id: objectIdSchema('story ID')
  }),
  body: z.object({
    title: z
      .string()
      .trim()
      .min(1, 'Title cannot be empty')
      .min(3, 'Title must be at least 3 characters')
      .max(100, 'Title must be at most 100 characters')
      .optional(),
    story: z
      .string()
      .trim()
      .min(1, 'Story content cannot be empty')
      .max(50000, 'Story content cannot exceed 50,000 characters')
      .optional(),
    category: categoryEnum.optional()
  })
});

export type UpdateStoryInput = z.infer<typeof updateStorySchema>;

// ============================================
// DELETE STORY SCHEMA
// ============================================
export const deleteStorySchema = z.object({
  params: z.object({
    id: objectIdSchema('story ID')
  })
});

export type DeleteStoryInput = z.infer<typeof deleteStorySchema>;

// ============================================
// LIKE STORY SCHEMA
// ============================================
export const likeStorySchema = z.object({
  params: z.object({
    id: objectIdSchema('story ID')
  })
});

export type LikeStoryInput = z.infer<typeof likeStorySchema>;

// ============================================
// GET LIKED BY SCHEMA
// ============================================
export const getLikedBySchema = z.object({
  params: z.object({
    id: objectIdSchema('story ID')
  })
});

export type GetLikedByInput = z.infer<typeof getLikedBySchema>;

// ============================================
// DOWNLOAD STORY PDF SCHEMA
// ============================================
export const downloadStoryPDFSchema = z.object({
  params: z.object({
    id: objectIdSchema('story ID')
  })
});

export type DownloadStoryPDFInput = z.infer<typeof downloadStoryPDFSchema>;

// ============================================
// SEARCH GIFS SCHEMA
// ============================================
export const searchGifsSchema = z.object({
  query: z.object({
    q: z
      .string()
      .trim()
      .min(1, 'Search query is required')
  })
});

export type SearchGifsInput = z.infer<typeof searchGifsSchema>;
