import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../models/db';
import { QueueManager } from '../queues/queueManager';
import { AIService } from '../services/aiService';
import { AuditService } from '../services/auditService';

export class AutomationController {
  /**
   * Starts the email automation batch.
   * Feeds all QUEUED recipients into the queue manager.
   */
  static async start(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = req.user?.companyId || null;
      const { templateId, emailTemplateId } = req.body;

      if (!templateId || !emailTemplateId) {
        return res.status(400).json({ error: 'Document template and email template are required.' });
      }

      // Check if templates exist
      const docTemplate = await prisma.template.findUnique({ where: { id: templateId } });
      const emailTemplate = await prisma.emailTemplate.findUnique({ where: { id: emailTemplateId } });

      if (!docTemplate || !emailTemplate) {
        return res.status(404).json({ error: 'Selected templates were not found.' });
      }

      // Retrieve all recipients marked as QUEUED or FAILED (with retry count reset)
      const pendingRecipients = await prisma.recipient.findMany({
        where: {
          companyId,
          status: { in: ['QUEUED', 'FAILED'] },
        },
      });

      if (pendingRecipients.length === 0) {
        return res.status(400).json({ error: 'No pending recipients found to automate. Upload or add some first.' });
      }

      // Reset retry count and set status to QUEUED in bulk
      await prisma.recipient.updateMany({
        where: {
          id: { in: pendingRecipients.map(r => r.id) },
        },
        data: {
          status: 'QUEUED',
          errorMsg: null,
          retryCount: 0,
        },
      });

      // Enqueue job for each recipient concurrently
      const jobs = pendingRecipients.map(recipient =>
        QueueManager.addJob({
          recipientId: recipient.id,
          templateId,
          emailTemplateId,
        })
      );
      await Promise.all(jobs);

      await AuditService.log(
        req.user?.id || null,
        'AUTOMATION_START',
        `Started automation for ${pendingRecipients.length} recipients. DocTemplate: ${docTemplate.name}, EmailTemplate: ${emailTemplate.name}`,
        req.ip
      );

      return res.status(200).json({
        message: `Successfully queued ${pendingRecipients.length} jobs for processing.`,
        count: pendingRecipients.length,
      });
    } catch (error) {
      console.error('Start automation error:', error);
      return res.status(500).json({ error: 'An error occurred starting automation.' });
    }
  }

  /**
   * Returns progress details of the automation batch.
   */
  static async getProgress(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = req.user?.companyId || null;

      // Group recipients by status to calculate stats
      const recipientsGroup = await prisma.recipient.groupBy({
        by: ['status'],
        where: { companyId },
        _count: {
          status: true,
        },
      });

      const stats = {
        queued: 0,
        sending: 0,
        sent: 0,
        failed: 0,
        bounced: 0,
        total: 0,
      };

      recipientsGroup.forEach((group) => {
        const count = group._count.status;
        if (group.status === 'QUEUED') stats.queued = count;
        if (group.status === 'SENDING') stats.sending = count;
        if (group.status === 'SENT') stats.sent = count;
        if (group.status === 'FAILED') stats.failed = count;
        if (group.status === 'BOUNCED') stats.bounced = count;
      });

      stats.total = stats.queued + stats.sending + stats.sent + stats.failed + stats.bounced;

      const completed = stats.sent + stats.failed + stats.bounced;
      const progressPercent = stats.total > 0 ? Math.round((completed / stats.total) * 100) : 0;
      const isFinished = stats.total > 0 && (stats.queued === 0 && stats.sending === 0);

      // Generate AI summary if finished
      let aiSummary = '';
      if (isFinished && stats.total > 0) {
        aiSummary = await AIService.summarizeResults({
          total: stats.total,
          success: stats.sent,
          failed: stats.failed,
          bounced: stats.bounced,
        });
      }

      return res.status(200).json({
        stats,
        progressPercent,
        isFinished,
        aiSummary,
      });
    } catch (error) {
      console.error('Get progress error:', error);
      return res.status(500).json({ error: 'An error occurred fetching progress.' });
    }
  }
}
