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

const router = Router();

router.post('/signup', signup);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/logout', logout); // Supports GET for ease of use (like original EJS app)
router.post('/logout', logout); // Also supports POST for standard SPA best practices
router.get('/check', checkAuth);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

export default router;
