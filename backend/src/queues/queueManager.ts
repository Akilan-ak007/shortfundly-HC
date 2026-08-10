import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { PDFService } from '../services/pdfService';
import { EmailService } from '../services/emailService';
import prisma from '../models/db';
import path from 'path';
import fs from 'fs';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const QUEUE_NAME = 'email-automation-queue';

export interface AutomationJobData {
  recipientId: string;
  templateId: string;
  emailTemplateId: string;
}

export class QueueManager {
  private static queue: Queue | null = null;
  private static worker: Worker | null = null;
  private static isRedisAvailable = false;

  // In-memory queue fallback for when Redis is unavailable
  private static memoryQueue: Array<AutomationJobData> = [];
  private static isProcessingMemoryQueue = false;

  /**
   * Initializes the queue.
   */
  static async initialize() {
    try {
      console.log(`Connecting to Redis at: ${REDIS_URL}`);
      const testConnection = new IORedis(REDIS_URL, {
        maxRetriesPerRequest: 1, // Fail fast to activate memory queue
        connectTimeout: 2000,
      });

      testConnection.on('error', (err) => {
        // Suppress logs for initial check failure
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.isRedisAvailable = false;
          resolve();
        }, 2500);

        testConnection.ping()
          .then(() => {
            clearTimeout(timeout);
            this.isRedisAvailable = true;
            resolve();
          })
          .catch(() => {
            clearTimeout(timeout);
            this.isRedisAvailable = false;
            resolve();
          });
      });

      // Safely close the testing connection
      await testConnection.quit().catch(() => {});

      if (this.isRedisAvailable) {
        console.log('Redis connected successfully. Initializing BullMQ.');
        
        // Create clean connections for BullMQ (must have maxRetriesPerRequest: null)
        const connection = new IORedis(REDIS_URL, {
          maxRetriesPerRequest: null,
        });

        this.queue = new Queue(QUEUE_NAME, {
          connection,
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          },
        });

        const workerConnection = new IORedis(REDIS_URL, {
          maxRetriesPerRequest: null,
        });
        this.startBullWorker(workerConnection);
      } else {
        console.warn('Using in-memory queue fallback. BullMQ and Redis are disabled.');
      }
    } catch (error) {
      this.isRedisAvailable = false;
      console.warn('Failed to initialize Redis connection. Falling back to in-memory queue.', error);
    }
  }

  /**
   * Enqueues a new automation job.
   */
  static async addJob(data: AutomationJobData) {
    if (process.env.VERCEL || process.env.PROCESS_MODE === 'sync' || process.env.PROCESS_MODE === 'serverless') {
      console.log(`Running job synchronously for recipient ${data.recipientId} (Serverless Mode)`);
      try {
        await this.executeJob(data);
      } catch (error: any) {
        console.error(`Synchronous job failed for recipient ${data.recipientId}:`, error);
        await this.handleJobFailure(data, error.message || 'Unknown error', 1);
      }
    } else if (this.isRedisAvailable && this.queue) {
      await this.queue.add(`job-${data.recipientId}`, data);
    } else {
      this.memoryQueue.push(data);
      this.processMemoryQueue();
    }
  }

  /**
   * Starts the BullMQ worker processor.
   */
  private static startBullWorker(connection: IORedis) {
    this.worker = new Worker(
      QUEUE_NAME,
      async (job: Job<AutomationJobData>) => {
        console.log(`Processing BullMQ job for recipient ${job.data.recipientId}`);
        await this.executeJob(job.data);
      },
      { connection }
    );

    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully.`);
    });

    this.worker.on('failed', async (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
      if (job?.data) {
        await this.handleJobFailure(job.data, err.message, job.attemptsMade);
      }
    });
  }

  /**
   * Starts processing the in-memory queue (fallback strategy).
   */
  private static async processMemoryQueue() {
    if (this.isProcessingMemoryQueue) return;
    this.isProcessingMemoryQueue = true;

    while (this.memoryQueue.length > 0) {
      const jobData = this.memoryQueue.shift();
      if (jobData) {
        try {
          await this.executeJob(jobData);
        } catch (error: any) {
          console.error(`In-memory job failed for recipient ${jobData.recipientId}:`, error);
          await this.handleJobFailure(jobData, error.message || 'Unknown error', 3);
        }
      }
    }

    this.isProcessingMemoryQueue = false;
  }

  /**
   * Runs the core automation steps for a recipient:
   * 1. Reads details from database
   * 2. Replaces placeholders and generates PDF
   * 3. Sends email with Nodemailer
   * 4. Updates status to SENT
   */
  private static async executeJob(data: AutomationJobData) {
    const { recipientId, templateId, emailTemplateId } = data;

    // Update status to SENDING
    await prisma.recipient.update({
      where: { id: recipientId },
      data: { status: 'SENDING', errorMsg: null },
    });

    const recipient = await prisma.recipient.findUnique({
      where: { id: recipientId },
      include: { company: true },
    });

    const docTemplate = await prisma.template.findUnique({
      where: { id: templateId },
    });

    const emailTemplate = await prisma.emailTemplate.findUnique({
      where: { id: emailTemplateId },
    });

    if (!recipient || !docTemplate || !emailTemplate) {
      throw new Error(`Data missing: recipient: ${!!recipient}, docTemplate: ${!!docTemplate}, emailTemplate: ${!!emailTemplate}`);
    }

    const settings = await prisma.settings.findFirst();
    const emailProvider = settings?.provider || 'SMTP';

    // Set up placeholders variables
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

    // 1. PDF Generation
    const storageDir = process.env.STORAGE_DIR || './storage';
    const docFilename = `${recipient.name.replace(/\s+/g, '_')}_${recipient.id.substring(0, 8)}.pdf`;
    const pdfPath = path.join(storageDir, docFilename);

    // Optional verification link encoded in QR code
    const verificationUrl = `https://platform-verify.com/doc/${recipient.id}`;
    
    await PDFService.generate(
      docTemplate.content,
      variables,
      docTemplate.type,
      pdfPath,
      verificationUrl,
      docTemplate.designMetadata
    );

    // Save generated document path to database
    await prisma.generatedDocument.create({
      data: {
        recipientId: recipient.id,
        documentType: docTemplate.type,
        fileUrl: pdfPath,
      },
    });

    // 2. Email Placeholders replacement
    let subject = emailTemplate.subject;
    let body = emailTemplate.body;
    let signature = emailTemplate.signature || '';

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      subject = subject.replace(placeholder, value);
      body = body.replace(placeholder, value);
      signature = signature.replace(placeholder, value);
    }

    const fullHtmlBody = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f1f5f9; border-radius: 8px;">
        <p>${body.replace(/\n/g, '<br>')}</p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;">
        <p style="font-size: 13px; color: #64748b;">${signature.replace(/\n/g, '<br>')}</p>
      </div>
    `;

    // 3. Nodemailer dispatch
    await EmailService.send({
      to: recipient.email,
      subject: subject,
      html: fullHtmlBody,
      attachments: [
        {
          filename: recipient.attachmentFileName || docFilename,
          path: pdfPath,
        },
      ],
    });

    // Log the successful sent status
    await prisma.emailLog.create({
      data: {
        recipientId: recipient.id,
        status: 'SENT',
        provider: emailProvider,
        sentAt: new Date(),
      },
    });

    // Update Recipient status
    await prisma.recipient.update({
      where: { id: recipientId },
      data: { status: 'SENT', errorMsg: null },
    });
  }

  /**
   * Tracks and records failed runs.
   */
  private static async handleJobFailure(
    data: AutomationJobData,
    errorMessage: string,
    retryCount: number
  ) {
    const settings = await prisma.settings.findFirst();
    const emailProvider = settings?.provider || 'SMTP';

    // Log the failed status
    await prisma.emailLog.create({
      data: {
        recipientId: data.recipientId,
        status: 'FAILED',
        provider: emailProvider,
        errorMessage,
        retryCount,
      },
    });

    // Update recipient record with failure message
    await prisma.recipient.update({
      where: { id: data.recipientId },
      data: {
        status: 'FAILED',
        errorMsg: errorMessage,
        retryCount,
      },
    });
  }
}
