import dotenv from 'dotenv';
// Load environment variables first
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { connectDB } from './config/db';
import socketHandler from './socket';

const app = express();
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Run Socket.io listeners
socketHandler(io);

// Make socket io available in requests if needed
app.set('io', io);

// Socket handler
// Note: We will implement this TS file later in Phase 3/4.
// For now, we will create a placeholder socket configuration.
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});



// --------------------
// Middlewares
// --------------------

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow loading media from other origins
  contentSecurityPolicy: false // SPA will load assets directly
}));

// CORS Configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api', limiter);

// Request parsing & optimization
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.SESSION_SECRET || 'METAMORPHOSIS'));
app.use(compression());
app.use(morgan('dev'));

// --------------------
// API Routes Placeholder
// --------------------
import authRoutes from './routes/auth';
import storiesRoutes from './routes/stories';
import commentsRoutes from './routes/comments';
import usersRoutes from './routes/users';
import chatRoutes from './routes/chat';
import ttsRoutes from './routes/tts';

app.use('/api/auth', authRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/stories/:storyId/comments', commentsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/tts', ttsRoutes);

// Catch-all API 404
app.use('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// --------------------
// Error Handler
// --------------------
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[SERVER] Server Error:', err);
  res.status(err.status || err.http_code || 500).json({
    error: err.message || 'Internal Server Error',
    name: err.name || 'Error'
  });
});

const PORT = process.env.PORT || 3000;

const startServer = async (): Promise<void> => { 
  try {
    await connectDB();

    server.listen(PORT, () => {
      console.log(`[SERVER] Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[SERVER] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
export { app, server };
// Server auto-reload trigger comment
