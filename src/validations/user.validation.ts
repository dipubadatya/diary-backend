import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = (fieldName: string) => 
  z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: `Invalid ${fieldName}`
  });

// ============================================
// EXISTING USERNAME SCHEMA
// ============================================
export const existingUsernameSchema = z.object({
  params: z.object({
    username: z
      .string()
      .trim()
      .min(1, 'Username is required')
  })
});

export type ExistingUsernameInput = z.infer<typeof existingUsernameSchema>;

// ============================================
// GET USER PROFILE SCHEMA
// ============================================
export const getUserProfileSchema = z.object({
  params: z.object({
    username: z
      .string()
      .trim()
      .min(1, 'Username or ID is required')
  })
});

export type GetUserProfileInput = z.infer<typeof getUserProfileSchema>;

// ============================================
// ADD RECENT SEARCH SCHEMA
// ============================================
export const addRecentSearchSchema = z.object({
  body: z.object({
    writerId: objectIdSchema('writer ID')
  })
});

export type AddRecentSearchInput = z.infer<typeof addRecentSearchSchema>;

// ============================================
// REMOVE RECENT SEARCH SCHEMA
// ============================================
export const removeRecentSearchSchema = z.object({
  params: z.object({
    id: objectIdSchema('writer ID')
  })
});

export type RemoveRecentSearchInput = z.infer<typeof removeRecentSearchSchema>;

// ============================================
// UPDATE PROFILE SCHEMA
// ============================================
export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(1, 'Name cannot be empty')
        .max(50, 'Name must be at most 50 characters')
        .optional(),
      username: z
        .string()
        .trim()
        .min(1, 'Username cannot be empty')
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username must be at most 30 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
        .optional(),
      bio: z
        .string()
        .trim()
        .max(160, 'Bio must be at most 160 characters')
        .optional()
    })
    .refine((data) => data.name !== undefined || data.username !== undefined || data.bio !== undefined, {
      message: 'At least one field (name, username, or bio) is required to update.',
      path: ['name']
    })
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ============================================
// TOGGLE FOLLOW SCHEMA
// ============================================
export const toggleFollowSchema = z.object({
  params: z.object({
    id: objectIdSchema('user ID')
  })
});

export type ToggleFollowInput = z.infer<typeof toggleFollowSchema>;

// ============================================
// GET FOLLOWERS / GET FOLLOWING SCHEMA
// ============================================
export const getFollowersSchema = z.object({
  params: z.object({
    id: objectIdSchema('user ID')
  }),
  query: z.object({
    page: z.string().regex(/^\d+$/, 'Page must be a number').optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a number').optional()
  })
});

export type GetFollowersInput = z.infer<typeof getFollowersSchema>;

export const getFollowingSchema = getFollowersSchema;
export type GetFollowingInput = z.infer<typeof getFollowingSchema>;

// ============================================
// DELETE NOTIFICATION SCHEMA
// ============================================
export const deleteNotificationSchema = z.object({
  params: z.object({
    notifId: objectIdSchema('notification ID')
  })
});

export type DeleteNotificationInput = z.infer<typeof deleteNotificationSchema>;

// ============================================
// CHANGE PASSWORD SCHEMA
// ============================================
export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z
        .string()
        .min(1, 'New password is required')
        .min(8, 'New password must be at least 8 characters long')
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: 'New password must be different from the current password.',
      path: ['newPassword']
    })
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ============================================
// SEARCH WRITERS SCHEMA
// ============================================
export const searchWritersSchema = z.object({
  query: z.object({
    q: z.string().trim().optional()
  })
});

export type SearchWritersInput = z.infer<typeof searchWritersSchema>;
