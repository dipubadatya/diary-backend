import { Router } from 'express';
import {
  signup,
  verifyEmail,
  resendVerification,
  login,
  logout,
  checkAuth,
  forgotPassword,
  resetPassword,
  googleLogin
} from '../controllers/auth';
import { validate } from '../middlewares/validate.middleware';
import {
  signupSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginSchema,
  googleLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from '../validations/auth.validation';

const router = Router();

router.post('/signup', validate(signupSchema), signup);
router.get('/verify-email', validate(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', validate(resendVerificationSchema), resendVerification);
router.post('/login', validate(loginSchema), login);
router.post('/google', validate(googleLoginSchema), googleLogin);
router.get('/logout', logout); // Supports GET for ease of use (like original EJS app)
router.post('/logout', logout); // Also supports POST for standard SPA best practices
router.get('/check', checkAuth);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password/:token', validate(resetPasswordSchema), resetPassword);

export default router;
