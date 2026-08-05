import prisma from '../models/db';
import { PDFService } from '../services/pdfService';
import { EmailService } from '../services/emailService';
import path from 'path';
import fs from 'fs';

async function runAutomation() {
  console.log('🚀 Starting standalone CLI email automation runner...');

  // Fetch standard configurations
  const settings = await prisma.settings.findFirst();
  if (!settings) {
    console.error('❌ Database Settings missing. Please configure settings first.');
    process.exit(1);
  }
  const emailProvider = settings.provider || 'SMTP';

  // Find all recipients currently marked as QUEUED or FAILED
  const pendingRecipients = await prisma.recipient.findMany({
    where: {
      status: { in: ['QUEUED', 'FAILED'] },
    },
    include: {
      company: true,
    },
  });

  if (pendingRecipients.length === 0) {
    console.log('ℹ️ No pending (QUEUED or FAILED) recipients found in the database. Exiting.');
    process.exit(0);
  }

  console.log(`📋 Found ${pendingRecipients.length} recipients to process. Starting dispatch...`);

  // Default templates to use (if none, we pick the first one)
  const docTemplate = await prisma.template.findFirst();
  const emailTemplate = await prisma.emailTemplate.findFirst();

  if (!docTemplate || !emailTemplate) {
    console.error('❌ Make sure you have at least one document template and email template in the database.');
    process.exit(1);
  }

  for (const recipient of pendingRecipients) {
    console.log(`\n👤 Processing Recipient: ${recipient.name} (${recipient.email})`);
    
    try {
      // Update status to SENDING
      await prisma.recipient.update({
        where: { id: recipient.id },
        data: { status: 'SENDING', errorMsg: null },
      });

      // Prepare replacement variables
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
      const pdfPath = path.resolve(storageDir, docFilename);

      // Ensure directory exists
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }

      const verificationUrl = `https://platform-verify.com/doc/${recipient.id}`;

      console.log(`📄 Generating PDF for ${recipient.name}...`);
      await PDFService.generate(
        docTemplate.content,
        variables,
        docTemplate.type,
        pdfPath,
        verificationUrl,
        docTemplate.designMetadata
      );

      // Save document log
      await prisma.generatedDocument.create({
        data: {
          recipientId: recipient.id,
          documentType: docTemplate.type,
          fileUrl: pdfPath,
        },
      });

      // 2. Body / Subject Variables Replacement
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

      // 3. Email Dispatch via Nodemailer
      console.log(`✉️ Dispatching email using provider: ${emailProvider}...`);
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

      // Success logging
      await prisma.emailLog.create({
        data: {
          recipientId: recipient.id,
          status: 'SENT',
          provider: emailProvider,
          sentAt: new Date(),
        },
      });

      await prisma.recipient.update({
        where: { id: recipient.id },
        data: { status: 'SENT', errorMsg: null },
      });

      console.log(`✅ Success! Email successfully sent to ${recipient.email}.`);

    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error occurred';
      console.error(`❌ Failed processing ${recipient.name}:`, errorMessage);

      // Failure logging
      await prisma.emailLog.create({
        data: {
          recipientId: recipient.id,
          status: 'FAILED',
          provider: emailProvider,
          errorMessage,
          retryCount: recipient.retryCount + 1,
        },
      });

      await prisma.recipient.update({
        where: { id: recipient.id },
        data: {
          status: 'FAILED',
          errorMsg: errorMessage,
          retryCount: recipient.retryCount + 1,
        },
      });
    }
  }

  console.log('\n🏁 Automation execution cycle completed!');
  process.exit(0);
}

runAutomation().catch((e) => {
  console.error('Fatal crash running automation script:', e);
  process.exit(1);
});
