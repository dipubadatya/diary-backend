import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/user';
import { sendVerificationEmail, sendResetPasswordEmail, sendPasswordConfirmationEmail } from '../services/mail';

const cookieOptions = {
  httpOnly: true,
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

export const signup = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
       res.status(400).json({ error: 'All fields are required.' });
       return;
    }

    // Check for existing unverified user
    const unverifiedUser = await User.findOne({ email, isVerified: false });
    if (unverifiedUser) {
       res.status(400).json({ error: 'Email registered but not verified. Check your email or request another link.' });
       return;
    }

    // Check for existing verified user
    const verifiedUser = await User.findOne({ email, isVerified: true });
    if (verifiedUser) {
       res.status(400).json({ error: 'This email is already registered and verified.' });
       return;
    }

    // Check for existing username
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
       res.status(400).json({ error: 'A user with the given username is already registered.' });
       return;
    }

    const verificationToken = crypto.randomBytes(20).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = new User({
      name,
      username,
      email,
      password, // will be hashed by pre-save hook
      isVerified: false,
      verificationToken,
      verificationTokenExpires
    });

    await user.save();

    // Send verification email
    try {
      const host = req.headers.host || 'localhost:3000';
      const protocol = req.protocol || 'http';
      await sendVerificationEmail(email, username, verificationToken, host, protocol);
    } catch (mailErr) {
      console.error('Failed to send verification email:', mailErr);
      res.status(201).json({
        success: true,
        message: 'Registered successfully, but we failed to send the verification email. Please try resending verification link.'
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful! A verification email has been sent.'
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    let errorMessage = 'Registration failed. Please try again.';
    if (error.message && error.message.includes('Email already in use')) {
      errorMessage = 'Email already in use. Please use a different email.';
    } else if (error.code === 11000) {
      errorMessage = 'A user with the given username / email is already registered.';
    }
    res.status(500).json({ error: errorMessage });
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
       res.status(400).json({ error: 'No verification token provided.' });
       return;
    }

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() }
    });

    if (!user) {
       res.status(400).json({ error: 'Verification token is invalid or has expired. Please register again.' });
       return;
    }

    if (user.isVerified) {
       res.status(200).json({ success: true, message: 'This email is already verified. Please log in.' });
       return;
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now log in.'
    });
  } catch (error) {
    next(error);
  }
};

export const resendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
       res.status(400).json({ error: 'Email is required.' });
       return;
    }

    const user = await User.findOne({ email });

    if (!user) {
       res.status(404).json({ error: 'No account found with this email.' });
       return;
    }

    if (user.isVerified) {
       res.status(400).json({ error: 'This email is already verified. Please log in.' });
       return;
    }

    const verificationToken = crypto.randomBytes(20).toString('hex');
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const host = req.headers.host || 'localhost:3000';
    const protocol = req.protocol || 'http';
    await sendVerificationEmail(user.email, user.username, verificationToken, host, protocol);

    res.status(200).json({
      success: true,
      message: 'Verification link has been resent to your email.'
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, username, password } = req.body;

    const loginIdentifier = username || email;

    if (!loginIdentifier || !password) {
      res.status(400).json({ error: 'Email/Username and password are required.' });
      return;
    }

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { email: loginIdentifier },
        { username: loginIdentifier }
      ]
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Compare passwords using our model method
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Check email verification
    if (!user.isVerified) {
      try {
        const verificationToken = crypto.randomBytes(20).toString('hex');
        user.verificationToken = verificationToken;
        user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await user.save();

        const host = req.headers.host || 'localhost:3000';
        const protocol = req.protocol || 'http';
        await sendVerificationEmail(user.email, user.username, verificationToken, host, protocol);

        res.status(403).json({
          error: 'Your account is not verified. We have sent a new verification link. Please check your email.',
          isVerified: false
        });
      } catch (mailErr) {
        console.error('Failed to resend verification email on login:', mailErr);
        res.status(403).json({
          error: 'Your account is not verified. Failed to send a new verification link.',
          isVerified: false
        });
      }
      return;
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'DIARY_APP_SECRET',
      { expiresIn: '7d' }
    );

    // Set cookie
    res.cookie('token', token, cookieOptions);

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        image: user.image,
        banner: user.banner,
        bio: user.bio,
        followersCount: user.followers.length,
        followingCount: user.following.length,
        storiesCount: user.stories.length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
  try {
    const clearOptions = {
      httpOnly: true,
      sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
      secure: process.env.NODE_ENV === 'production'
    };
    res.clearCookie('token', clearOptions);
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed. Please try again.' });
  }
};

export const checkAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({ isAuthenticated: false, error: 'Not authenticated.' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'DIARY_APP_SECRET') as { userId: string };
    
    if (!decoded || !decoded.userId) {
      res.status(401).json({ isAuthenticated: false, error: 'Not authenticated.' });
      return;
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ isAuthenticated: false, error: 'Not authenticated.' });
      return;
    }

    res.status(200).json({
      isAuthenticated: true,
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        image: user.image,
        banner: user.banner,
        bio: user.bio,
        followersCount: user.followers.length,
        followingCount: user.following.length,
        storiesCount: user.stories.length
      }
    });
  } catch (error) {
    res.status(401).json({ isAuthenticated: false, error: 'Not authenticated.' });
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
       res.status(400).json({ error: 'Email is required.' });
       return;
    }

    const user = await User.findOne({ email });
    if (!user) {
       res.status(404).json({ error: 'We couldn’t find an account with that email address.' });
       return;
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    const host = req.headers.host || 'localhost:3000';
    const protocol = req.protocol || 'http';
    await sendResetPasswordEmail(user.email, user.username, resetToken, host, protocol);

    res.status(200).json({
      success: true,
      message: 'Password reset link has been sent to your email.'
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { password, confirmPassword } = req.body;
    const { token } = req.params;

    if (!password || !confirmPassword) {
       res.status(400).json({ error: 'Please fill in all fields.' });
       return;
    }

    if (password.length < 6) {
       res.status(400).json({ error: 'Password must be at least 6 characters.' });
       return;
    }

    if (password !== confirmPassword) {
       res.status(400).json({ error: 'Passwords do not match.' });
       return;
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
       res.status(400).json({ error: 'Your password reset link has expired or is invalid. Please request a new one.' });
       return;
    }

    user.password = password; // pre-save hook will hash it automatically
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    try {
      await sendPasswordConfirmationEmail(user.email, user.username);
    } catch (mailErr) {
      console.error('Failed to send password reset confirmation email:', mailErr);
    }

    res.status(200).json({
      success: true,
      message: 'Password reset successful! You can now log in.'
    });
  } catch (error) {
    next(error);
  }
};
