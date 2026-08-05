import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../models/db';
import { AIService } from '../services/aiService';
import { AuditService } from '../services/auditService';

export class TemplateController {
  // ==========================================
  // DOCUMENT TEMPLATES (PDF Layouts)
  // ==========================================

  static async listDocTemplates(req: AuthenticatedRequest, res: Response) {
    try {
      const templates = await prisma.template.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json(templates);
    } catch (error) {
      console.error('List doc templates error:', error);
      return res.status(500).json({ error: 'An error occurred listing document templates.' });
    }
  }

  static async createDocTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, type, content, designMetadata } = req.body;

      if (!name || !type || !content) {
        return res.status(400).json({ error: 'Name, document type, and content are required.' });
      }

      const template = await prisma.template.create({
        data: {
          name,
          type,
          content,
          designMetadata: designMetadata || {},
        },
      });

      await AuditService.log(
        req.user?.id || null,
        'TEMPLATE_CREATE',
        `Created document template: ${name}`,
        req.ip
      );

      return res.status(201).json(template);
    } catch (error) {
      console.error('Create doc template error:', error);
      return res.status(500).json({ error: 'An error occurred creating document template.' });
    }
  }

  static async updateDocTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, type, content, designMetadata } = req.body;

      const template = await prisma.template.findUnique({ where: { id } });
      if (!template) {
        return res.status(404).json({ error: 'Document template not found.' });
      }

      const updated = await prisma.template.update({
        where: { id },
        data: { name, type, content, designMetadata },
      });

      await AuditService.log(
        req.user?.id || null,
        'TEMPLATE_UPDATE',
        `Updated document template: ${name}`,
        req.ip
      );

      return res.status(200).json(updated);
    } catch (error) {
      console.error('Update doc template error:', error);
      return res.status(500).json({ error: 'An error occurred updating document template.' });
    }
  }

  static async deleteDocTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const template = await prisma.template.findUnique({ where: { id } });
      if (!template) {
        return res.status(404).json({ error: 'Document template not found.' });
      }

      await prisma.template.delete({ where: { id } });

      await AuditService.log(
        req.user?.id || null,
        'TEMPLATE_DELETE',
        `Deleted document template: ${template.name}`,
        req.ip
      );

      return res.status(200).json({ message: 'Document template deleted.' });
    } catch (error) {
      console.error('Delete doc template error:', error);
      return res.status(500).json({ error: 'An error occurred deleting document template.' });
    }
  }

  // ==========================================
  // EMAIL TEMPLATES
  // ==========================================

  static async listEmailTemplates(req: AuthenticatedRequest, res: Response) {
    try {
      const templates = await prisma.emailTemplate.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json(templates);
    } catch (error) {
      console.error('List email templates error:', error);
      return res.status(500).json({ error: 'An error occurred listing email templates.' });
    }
  }

  static async createEmailTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, subject, body, signature } = req.body;

      if (!name || !subject || !body) {
        return res.status(400).json({ error: 'Name, subject, and body are required.' });
      }

      const existing = await prisma.emailTemplate.findUnique({ where: { name } });
      if (existing) {
        return res.status(400).json({ error: 'An email template with this name already exists.' });
      }

      const template = await prisma.emailTemplate.create({
        data: { name, subject, body, signature },
      });

      await AuditService.log(
        req.user?.id || null,
        'EMAIL_TEMPLATE_CREATE',
        `Created email template: ${name}`,
        req.ip
      );

      return res.status(201).json(template);
    } catch (error) {
      console.error('Create email template error:', error);
      return res.status(500).json({ error: 'An error occurred creating email template.' });
    }
  }

  static async updateEmailTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, subject, body, signature } = req.body;

      const template = await prisma.emailTemplate.findUnique({ where: { id } });
      if (!template) {
        return res.status(404).json({ error: 'Email template not found.' });
      }

      const updated = await prisma.emailTemplate.update({
        where: { id },
        data: { name, subject, body, signature },
      });

      await AuditService.log(
        req.user?.id || null,
        'EMAIL_TEMPLATE_UPDATE',
        `Updated email template: ${name}`,
        req.ip
      );

      return res.status(200).json(updated);
    } catch (error) {
      console.error('Update email template error:', error);
      return res.status(500).json({ error: 'An error occurred updating email template.' });
    }
  }

  static async deleteEmailTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const template = await prisma.emailTemplate.findUnique({ where: { id } });
      if (!template) {
        return res.status(404).json({ error: 'Email template not found.' });
      }

      await prisma.emailTemplate.delete({ where: { id } });

      await AuditService.log(
        req.user?.id || null,
        'EMAIL_TEMPLATE_DELETE',
        `Deleted email template: ${template.name}`,
        req.ip
      );

      return res.status(200).json({ message: 'Email template deleted successfully.' });
    } catch (error) {
      console.error('Delete email template error:', error);
      return res.status(500).json({ error: 'An error occurred deleting email template.' });
    }
  }

  // ==========================================
  // AI INTEGRATED API ENDPOINTS
  // ==========================================

  static async aiGenerateEmail(req: AuthenticatedRequest, res: Response) {
    try {
      const { prompt, position, department, company } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt instructions are required.' });
      }

      const bodyText = await AIService.generateEmailContent(prompt, {
        Position: position,
        Department: department,
        Company: company,
      });

      return res.status(200).json({ body: bodyText });
    } catch (error) {
      console.error('AI generate email error:', error);
      return res.status(500).json({ error: 'AI was unable to generate email body at this time.' });
    }
  }

  static async aiSuggestSubject(req: AuthenticatedRequest, res: Response) {
    try {
      const { position, company } = req.body;

      if (!position || !company) {
        return res.status(400).json({ error: 'Position and company are required.' });
      }

      const suggestions = await AIService.suggestSubjectLines(position, company);
      return res.status(200).json({ suggestions });
    } catch (error) {
      console.error('AI suggest subject error:', error);
      return res.status(500).json({ error: 'AI was unable to generate subject lines.' });
    }
  }

  static async aiDetectAnomalies(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = req.user?.companyId || null;
      // Get currently queued recipients
      const recipients = await prisma.recipient.findMany({
        where: {
          companyId,
          status: 'QUEUED',
        },
        select: {
          id: true,
          name: true,
          email: true,
          position: true,
          department: true,
        },
      });

      if (recipients.length === 0) {
        return res.status(200).json({ anomalies: [], message: 'No queued recipients to scan.' });
      }

      const anomalies = await AIService.detectIncorrectData(recipients);
      
      // Map row index to database ID and name for easy client interaction
      const mappedAnomalies = anomalies.map(a => ({
        recipientId: recipients[a.index].id,
        name: a.name,
        email: recipients[a.index].email,
        anomaly: a.anomaly,
      }));

      return res.status(200).json({ anomalies: mappedAnomalies });
    } catch (error) {
      console.error('AI detect anomalies error:', error);
      return res.status(500).json({ error: 'AI was unable to scan data anomalies.' });
    }
  }

  static async aiRecommendTime(req: AuthenticatedRequest, res: Response) {
    try {
      const recommendation = await AIService.recommendSendingTime();
      return res.status(200).json(recommendation);
    } catch (error) {
      console.error('AI recommend time error:', error);
      return res.status(500).json({ error: 'AI was unable to recommend a sending window.' });
    }
  }
}
