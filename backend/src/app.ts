import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import apiRouter from './routes';

const app = express();

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false, // Allows media files to be served cross-origin
}));

app.use(cors({
  origin: '*', // In production, replace with specific trusted origins
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Express JSON parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Rate Limiting (e.g. max 200 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Bind main REST API router
app.use('/api', apiRouter);

// Serve generated documents locally from storage folder (with safety checks)
const storageDir = process.env.STORAGE_DIR || './storage';
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}
app.use('/storage', express.static(path.resolve(storageDir)));

// Global Error Handler Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  return res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message || 'Internal server error.',
  });
});

export default app;
