import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const isLoggedIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token = req.cookies?.token;

    // Also support Bearer Token header for authentication flexibility
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({ error: 'Please log in to continue.' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'DIARY_APP_SECRET') as { userId: string };
    
    if (!decoded || !decoded.userId) {
      res.status(401).json({ error: 'Invalid token. Please log in again.' });
      return;
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ error: 'User session not found. Please log in again.' });
      return;
    }

    // Attach user to the request object
    req.user = user;
    next();
  } catch (error: any) {
    console.error('JWT Verification Error:', error);
    res.status(401).json({ error: 'Please log in to continue.' });
  }
};

export const optionalLoggedIn = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let token = req.cookies?.token;

    // Also support Bearer Token header for authentication flexibility
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'DIARY_APP_SECRET') as { userId: string };
      if (decoded && decoded.userId) {
        const user = await User.findById(decoded.userId);
        if (user) {
          req.user = user;
        }
      }
    }
    next();
  } catch (error) {
    // If token is invalid or expired, just treat as guest
    next();
  }
};
