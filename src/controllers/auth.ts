import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/user";
import {
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendPasswordConfirmationEmail,
} from "../services/mail";

// ------------------------------------------------------------------
// Config
// ------------------------------------------------------------------

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}

const JWT_EXPIRY = "7d";
const VERIFICATION_TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_TTL = 60 * 60 * 1000; // 1 hour

const cookieOptions = {
  httpOnly: true,
  sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as
    | "none"
    | "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const clearCookieOptions = {
  httpOnly: true,
  sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as
    | "none"
    | "lax",
  secure: process.env.NODE_ENV === "production",
};

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------


const generateToken = (): string => crypto.randomBytes(20).toString("hex");

const signAuthToken = (userId: string): string =>
  jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

const getRequestOrigin = (req: Request) => ({
  host: req.headers.host || "localhost:3000",
  protocol: req.protocol || "http",
});

const buildUserResponse = (user: any) => ({
  _id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  image: user.image,
  banner: user.banner,
  bio: user.bio,
  followersCount: user.followers.length,
  followingCount: user.following.length,
  storiesCount: user.stories.length,
});

// ------------------------------------------------------------------
// Signup
// ------------------------------------------------------------------

export const signup = async (
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> => {
  try {
    const { name, username, email, password } = req.body;

    const unverifiedUser = await User.findOne({ email, isVerified: false });
    if (unverifiedUser) {
      res.status(400).json({
        error:
          "Email registered but not verified. Check your email or request another link.",
      });
      return;
    }

    const verifiedUser = await User.findOne({ email, isVerified: true });
    if (verifiedUser) {
      res
        .status(400)
        .json({ error: "This email is already registered and verified." });
      return;
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      res.status(400).json({
        error: "A user with the given username is already registered.",
      });
      return;
    }

    const verificationToken = generateToken();
    const verificationTokenExpires = new Date(
      Date.now() + VERIFICATION_TOKEN_TTL,
    );

    const user = new User({
      name,
      username,
      email,
      password,
      isVerified: false,
      emailVerified: false,
      verificationToken,
      verificationTokenExpires,
    });

    await user.save();

    try {
      const { host, protocol } = getRequestOrigin(req);
      await sendVerificationEmail(
        email,
        username,
        verificationToken,
        host,
        protocol,
      );
    } catch (mailErr) {
      console.error("Failed to send verification email:", mailErr);
      res.status(201).json({
        success: true,
        message:
          "Registered successfully, but we failed to send the verification email. Please try resending verification link.",
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: "Registration successful! A verification email has been sent.",
    });
  } catch (error: any) {
    console.error("Signup error:", error);

    let errorMessage = "Registration failed. Please try again.";
    if (error.message?.includes("Email already in use")) {
      errorMessage = "Email already in use. Please use a different email.";
    } else if (error.code === 11000) {
      errorMessage =
        "A user with the given username / email is already registered.";
    }

    res.status(500).json({ error: errorMessage });
  }
};

// ------------------------------------------------------------------
// Email Verification
// ------------------------------------------------------------------

export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { token } = req.query as { token: string };

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({
        error:
          "Verification token is invalid or has expired. Please register again.",
      });
      return;
    }

    if (user.isVerified) {
      res.status(200).json({
        success: true,
        message: "This email is already verified. Please log in.",
      });
      return;
    }

    user.isVerified = true;
    user.emailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully! You can now log in.",
    });
  } catch (error) {
    next(error);
  }
};

export const resendVerification = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ error: "No account found with this email." });
      return;
    }

    if (user.isVerified) {
      res
        .status(400)
        .json({ error: "This email is already verified. Please log in." });
      return;
    }

    const verificationToken = generateToken();
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = new Date(
      Date.now() + VERIFICATION_TOKEN_TTL,
    );
    await user.save();

    const { host, protocol } = getRequestOrigin(req);
    await sendVerificationEmail(
      user.email,
      user.username,
      verificationToken,
      host,
      protocol,
    );

    res.status(200).json({
      success: true,
      message: "Verification link has been resent to your email.",
    });
  } catch (error) {
    next(error);
  }
};

export const changeEmail = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { oldEmail, newEmail } = req.body;

    if (oldEmail.toLowerCase() === newEmail.toLowerCase()) {
      res.status(400).json({ error: "New email must be different from current email." });
      return;
    }

    const user = await User.findOne({ email: oldEmail });
    if (!user) {
      res.status(404).json({ error: "No account found with this email." });
      return;
    }

    if (user.isVerified) {
      res
        .status(400)
        .json({ error: "This email is already verified. Please log in." });
      return;
    }

    // Check if new email is already in use by any other account
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser) {
      res.status(400).json({
        error: "This email is already registered. Please use another email.",
      });
      return;
    }

    user.email = newEmail;
    const verificationToken = generateToken();
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = new Date(
      Date.now() + VERIFICATION_TOKEN_TTL,
    );
    await user.save();

    const { host, protocol } = getRequestOrigin(req);
    await sendVerificationEmail(
      user.email,
      user.username,
      verificationToken,
      host,
      protocol,
    );

    res.status(200).json({
      success: true,
      message: "Email updated and verification link has been sent to your new email.",
    });
  } catch (error) {
    next(error);
  }
};

// ------------------------------------------------------------------
// Login / Logout
// ------------------------------------------------------------------

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, username, password } = req.body;
    const loginIdentifier = username || email;

    const user = await User.findOne({
      $or: [{ email: loginIdentifier }, { username: loginIdentifier }],
    });

    if (!user) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    // If user isn't verified, auto-resend the verification link
    if (!user.isVerified) {
      try {
        const verificationToken = generateToken();
        user.verificationToken = verificationToken;
        user.verificationTokenExpires = new Date(
          Date.now() + VERIFICATION_TOKEN_TTL,
        );
        await user.save();

        const { host, protocol } = getRequestOrigin(req);
        await sendVerificationEmail(
          user.email,
          user.username,
          verificationToken,
          host,
          protocol,
        );

        res.status(403).json({
          error:
            "Your account is not verified. We have sent a new verification link. Please check your email.",
          isVerified: false,
        });
      } catch (mailErr) {
        console.error("Failed to resend verification email on login:", mailErr);
        res.status(403).json({
          error:
            "Your account is not verified. Failed to send a new verification link.",
          isVerified: false,
        });
      }
      return;
    }

    const token = signAuthToken(user._id.toString());
    res.cookie("token", token, cookieOptions);

    res.status(200).json({
      success: true,
      message: "Login successful!",
      user: buildUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie("token", clearCookieOptions);
  res.status(200).json({ success: true, message: "Logged out successfully." });
};

// ------------------------------------------------------------------
// Auth Check
// ------------------------------------------------------------------

export const checkAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      res
        .status(401)
        .json({ isAuthenticated: false, error: "Not authenticated." });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    if (!decoded?.userId) {
      res
        .status(401)
        .json({ isAuthenticated: false, error: "Not authenticated." });
      return;
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      res
        .status(401)
        .json({ isAuthenticated: false, error: "Not authenticated." });
      return;
    }

    res.status(200).json({
      isAuthenticated: true,
      user: buildUserResponse(user),
    });
  } catch (error) {
    res
      .status(401)
      .json({ isAuthenticated: false, error: "Not authenticated." });
  }
};

// ------------------------------------------------------------------
// Password Reset
// ------------------------------------------------------------------

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({
        error: "We couldn’t find an account with that email address.",
      });
      return;
    }

    const resetToken = generateToken();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL);
    await user.save();

    const { host, protocol } = getRequestOrigin(req);
    await sendResetPasswordEmail(
      user.email,
      user.username,
      resetToken,
      host,
      protocol,
    );

    res.status(200).json({
      success: true,
      message: "Password reset link has been sent to your email.",
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({
        error:
          "Your password reset link has expired or is invalid. Please request a new one.",
      });
      return;
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    try {
      const { host, protocol } = getRequestOrigin(req);
      await sendPasswordConfirmationEmail(
        user.email,
        user.username,
        host,
        protocol,
      );
    } catch (mailErr) {
      console.error(
        "Failed to send password reset confirmation email:",
        mailErr,
      );
    }

    res.status(200).json({
      success: true,
      message: "Password reset successful! You can now log in.",
    });
  } catch (error) {
    next(error);
  }
};

// ------------------------------------------------------------------
// Google OAuth
// ------------------------------------------------------------------

export const googleLogin = async (
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> => {
  try {
    const { idToken } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(400).json({ error: "Google verification failed." });
      return;
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;
    const name = payload.name || email.split("@")[0];
    const picture = payload.picture;

    let user = await User.findOne({ email });

    if (user) {
      let updateNeeded = false;

      if (!user.isVerified) {
        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
        updateNeeded = true;
      }
      if (!user.googleId) {
        user.googleId = googleId;
        updateNeeded = true;
      }
      if (!user.provider) {
        user.provider = "google";
        updateNeeded = true;
      }

      if (updateNeeded) await user.save();
    } else {
      // Generate a unique username from the email
      let baseUsername = email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "");
      if (baseUsername.length < 3) baseUsername = "user_" + baseUsername;

      let username = baseUsername;
      let count = 0;
      while (await User.findOne({ username })) {
        count++;
        username = `${baseUsername}${count}`;
      }

      user = new User({
        name,
        username,
        email,
        provider: "google",
        googleId,
        avatar: picture,
        emailVerified: true,
        isVerified: true,
        image: picture
          ? { url: picture, filename: "google_profile" }
          : undefined,
      });

      await user.save();
    }

    const token = signAuthToken(user._id.toString());
    res.cookie("token", token, cookieOptions);

    res.status(200).json({
      success: true,
      message: "Login successful!",
      user: buildUserResponse(user),
    });
  } catch (error: any) {
    console.error("Google Auth Error:", error);
    res
      .status(400)
      .json({ error: error.message || "Google authentication failed." });
  }
};
