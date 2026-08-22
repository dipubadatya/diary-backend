import { z } from 'zod';

// ============================================
// SIGNUP SCHEMA
// ============================================
export const signupSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(50, 'Name must be at most 50 characters'),

    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username must be at most 20 characters')
      .regex(
        /^[a-zA-Z0-9_]+$/,
        'Username can only contain letters, numbers, and underscores'
      ),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, 'Email is required')
      .email('Invalid email address'),

    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters long')
      .max(64, 'Password cannot be longer than 64 characters'),
  }),
});

export type SignupInput = z.infer<typeof signupSchema>;

// ============================================
// LOGIN SCHEMA
// ============================================
export const loginSchema = z.object({
  body: z
    .object({
      username: z.string().trim().optional(),
      email: z.string().trim().optional(),
      password: z.string().min(1, 'Password is required')
    })
    .refine((data) => data.username || data.email, {
      message: 'Email or Username is required',
      path: ['username'] // Assign error to username field if neither is provided
    })
});

export type LoginInput = z.infer<typeof loginSchema>;

// ============================================
// RESEND VERIFICATION SCHEMA
// ============================================
export const resendVerificationSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .email('Invalid email address')
  })
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

// ============================================
// GOOGLE LOGIN SCHEMA
// ============================================
export const googleLoginSchema = z.object({
  body: z.object({
    idToken: z
      .string()
      .trim()
      .min(1, 'Google ID Token is required')
  })
});

export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;

// ============================================
// FORGOT PASSWORD SCHEMA
// ============================================
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .email('Invalid email address')
  })
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ============================================
// RESET PASSWORD SCHEMA
// ============================================
export const resetPasswordSchema = z.object({
  params: z.object({
    token: z
      .string()
      .trim()
      .min(1, 'Token is required')
  }),
  body: z
    .object({
      password: z
        .string()
        .min(1, 'Password is required')
        .min(8, 'Password must be at least 8 characters long')
        .max(64, 'Password cannot be longer than 64 characters'),
      confirmPassword: z.string().min(1, 'Please confirm your password')
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword']
    })
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ============================================
// VERIFY EMAIL SCHEMA
// ============================================
export const verifyEmailSchema = z.object({
  query: z.object({
    token: z
      .string()
      .trim()
      .min(1, 'Verification token is required')
  })
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
