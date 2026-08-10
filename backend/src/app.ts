import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import apiRouter from './routes';
import prisma from './models/db';
import { PDFService } from './services/pdfService';

// If running on Vercel, set STORAGE_DIR to /tmp so all libraries write to writable space
if (process.env.VERCEL) {
  process.env.STORAGE_DIR = '/tmp';
}

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

// Serve generated documents with dynamic self-healing regeneration fallback
const storageDir = process.env.STORAGE_DIR || './storage';
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

app.get('/storage/:filename', async (req, res, next) => {
  const { filename } = req.params;
  const filePath = path.resolve(storageDir, filename);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // Self-healing / Dynamic Regeneration fallback for serverless runtimes
  try {
    console.log(`Document ${filename} not found on disk. Regenerating...`);
    const docRecord = await prisma.generatedDocument.findFirst({
      where: {
        fileUrl: {
          endsWith: filename,
        },
      },
      include: {
        recipient: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!docRecord || !docRecord.recipient) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const recipient = docRecord.recipient;
    const docTemplate = await prisma.template.findFirst({
      where: { type: docRecord.documentType },
      orderBy: { updatedAt: 'desc' },
    });

    if (!docTemplate) {
      return res.status(404).json({ error: 'Template not found for document type: ' + docRecord.documentType });
    }

    const dateFormatted = new Date(recipient.joiningDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const variables = {
      Name: recipient.name,
      Position: recipient.position,
      Department: recipient.department,
      JoiningDate: dateFormatted,
      Company: recipient.company?.name || 'Company Name',
    };

    const verificationUrl = `https://platform-verify.com/doc/${recipient.id}`;

    await PDFService.generate(
      docTemplate.content,
      variables,
      docTemplate.type,
      filePath,
      verificationUrl,
      docTemplate.designMetadata
    );

    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    } else {
      return res.status(500).json({ error: 'Failed to dynamically regenerate PDF.' });
    }
  } catch (error) {
    console.error('Dynamic PDF regeneration error:', error);
    return res.status(500).json({ error: 'Error serving document.' });
  }
});

// Serve templates subfolder static assets if present
app.use('/storage/templates', express.static(path.resolve(storageDir, 'templates')));

// Global Error Handler Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  return res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message || 'Internal server error.',
  });
});

export default app;
