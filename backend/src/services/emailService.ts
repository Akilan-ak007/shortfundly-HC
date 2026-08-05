import nodemailer from 'nodemailer';
import prisma from '../models/db';

export interface MailOptions {
  to: string;
  subject: string;
  text?: string;
  html: string;
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
}

export class EmailService {
  /**
   * Generates a Nodemailer transporter based on active settings in the database.
   */
  static async getTransporter() {
    // Fetch settings from database. If none exist, use environment variables as fallback.
    let settings = await prisma.settings.findFirst();

    if (!settings) {
      // Create a default SMTP setting placeholder if none exists
      settings = await prisma.settings.create({
        data: {
          provider: 'SMTP',
          smtpHost: process.env.SMTP_HOST || 'smtp.mailtrap.io',
          smtpPort: parseInt(process.env.SMTP_PORT || '2525'),
          smtpUser: process.env.SMTP_USER || '',
          smtpPass: process.env.SMTP_PASS || '',
          defaultFrom: process.env.SMTP_FROM || 'no-reply@company.com',
        },
      });
    }

    const provider = settings.provider.toUpperCase();

    if (provider === 'SMTP' || provider === 'GMAIL') {
      return {
        transporter: nodemailer.createTransport({
          host: provider === 'GMAIL' ? 'smtp.gmail.com' : settings.smtpHost || '',
          port: provider === 'GMAIL' ? 465 : settings.smtpPort || 587,
          secure: (provider === 'GMAIL' || settings.smtpPort === 465),
          auth: settings.smtpUser && settings.smtpPass ? {
            user: settings.smtpUser,
            pass: settings.smtpPass,
          } : undefined,
          tls: {
            rejectUnauthorized: false
          }
        }),
        defaultFrom: settings.defaultFrom,
      };
    }

    // Providers configured via API keys but sending via standard SMTP relays
    // SendGrid SMTP Relay: smtp.sendgrid.net, user 'apikey', pass <API Key>
    if (provider === 'SENDGRID') {
      const apiKeys = settings.apiKeys as any;
      const apiKey = apiKeys?.sendGridKey || process.env.SENDGRID_API_KEY || '';
      return {
        transporter: nodemailer.createTransport({
          host: 'smtp.sendgrid.net',
          port: settings.smtpPort || 587,
          secure: settings.smtpPort === 465,
          auth: {
            user: 'apikey',
            pass: apiKey,
          },
          tls: {
            rejectUnauthorized: false
          }
        }),
        defaultFrom: settings.defaultFrom,
      };
    }

    // Mailgun SMTP Relay: smtp.mailgun.org, user <username>, pass <password>
    if (provider === 'MAILGUN') {
      const apiKeys = settings.apiKeys as any;
      const mgUser = apiKeys?.mailgunUser || '';
      const mgPass = apiKeys?.mailgunPassword || '';
      return {
        transporter: nodemailer.createTransport({
          host: 'smtp.mailgun.org',
          port: settings.smtpPort || 587,
          secure: settings.smtpPort === 465,
          auth: {
            user: mgUser,
            pass: mgPass,
          },
          tls: {
            rejectUnauthorized: false
          }
        }),
        defaultFrom: settings.defaultFrom,
      };
    }

    // Amazon SES SMTP Relay: email-smtp.us-east-1.amazonaws.com, user <SMTP Username>, pass <SMTP Password>
    if (provider === 'SES') {
      const apiKeys = settings.apiKeys as any;
      const sesUser = apiKeys?.sesUser || '';
      const sesPass = apiKeys?.sesPassword || '';
      const region = apiKeys?.region || 'us-east-1';
      return {
        transporter: nodemailer.createTransport({
          host: `email-smtp.${region}.amazonaws.com`,
          port: settings.smtpPort || 587,
          secure: settings.smtpPort === 465,
          auth: {
            user: sesUser,
            pass: sesPass,
          },
          tls: {
            rejectUnauthorized: false
          }
        }),
        defaultFrom: settings.defaultFrom,
      };
    }

    throw new Error(`Unsupported email provider: ${provider}`);
  }

  /**
   * Sends an email using the active transporter.
   */
  static async send(options: MailOptions): Promise<any> {
    const { transporter, defaultFrom } = await this.getTransporter();
    
    const mailData = {
      from: defaultFrom,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    };

    return transporter.sendMail(mailData);
  }

  /**
   * Verifies the email transport configurations.
   */
  static async verifyConnection(): Promise<boolean> {
    try {
      const { transporter } = await this.getTransporter();
      await transporter.verify();
      return true;
    } catch (error) {
      console.error('SMTP connection verification failed:', error);
      return false;
    }
  }
}
