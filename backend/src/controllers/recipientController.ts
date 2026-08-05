import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../models/db';
import { AuditService } from '../services/auditService';

export class RecipientController {
  /**
   * Retrieves a list of recipients with search, filtering, and pagination.
   */
  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = req.user?.companyId || null;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || '';
      const status = req.query.status as string;
      const department = req.query.department as string;
      const documentType = req.query.documentType as string;

      const skip = (page - 1) * limit;

      const where: any = { companyId };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { position: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (status) {
        where.status = status as any;
      }

      if (department) {
        where.department = { contains: department, mode: 'insensitive' };
      }

      if (documentType) {
        where.documentType = documentType as any;
      }

      const [recipients, totalCount] = await Promise.all([
        prisma.recipient.findMany({
          where,
          skip,
          take: limit,
          include: {
            generatedDocuments: true,
            emailLogs: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.recipient.count({ where }),
      ]);

      // Extract unique departments for filter dropdowns
      const departmentsData = await prisma.recipient.findMany({
        where: { companyId },
        select: { department: true },
        distinct: ['department'],
      });
      const departments = departmentsData.map(d => d.department);

      return res.status(200).json({
        recipients,
        pagination: {
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
          currentPage: page,
          limit,
        },
        departments,
      });
    } catch (error) {
      console.error('List recipients error:', error);
      return res.status(500).json({ error: 'An error occurred while listing recipients.' });
    }
  }

  /**
   * Adds a single recipient manually.
   */
  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = req.user?.companyId || null;
      const { name, email, position, department, joiningDate, documentType, attachmentFileName } = req.body;

      if (!name || !email || !position || !department || !joiningDate || !documentType) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }

      const existing = await prisma.recipient.findFirst({
        where: { email: email.toLowerCase(), companyId },
      });

      if (existing) {
        return res.status(400).json({ error: 'A recipient with this email already exists.' });
      }

      const recipient = await prisma.recipient.create({
        data: {
          name,
          email: email.toLowerCase(),
          position,
          department,
          joiningDate: new Date(joiningDate),
          documentType,
          attachmentFileName: attachmentFileName || null,
          companyId,
          status: 'QUEUED',
        },
      });

      await AuditService.log(
        req.user?.id || null,
        'RECIPIENT_CREATE',
        `Manually created recipient: ${email}`,
        req.ip
      );

      return res.status(201).json(recipient);
    } catch (error) {
      console.error('Create recipient error:', error);
      return res.status(500).json({ error: 'An error occurred creating recipient.' });
    }
  }

  /**
   * Updates an existing recipient's details.
   */
  static async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const companyId = req.user?.companyId || null;
      const { name, email, position, department, joiningDate, documentType, attachmentFileName, status } = req.body;

      const recipient = await prisma.recipient.findFirst({
        where: { id, companyId },
      });

      if (!recipient) {
        return res.status(404).json({ error: 'Recipient not found.' });
      }

      const updated = await prisma.recipient.update({
        where: { id },
        data: {
          name,
          email: email ? email.toLowerCase() : undefined,
          position,
          department,
          joiningDate: joiningDate ? new Date(joiningDate) : undefined,
          documentType,
          attachmentFileName: attachmentFileName !== undefined ? attachmentFileName : undefined,
          status,
          // Reset error message if retrying or updating status
          errorMsg: status === 'QUEUED' ? null : undefined,
          retryCount: status === 'QUEUED' ? 0 : undefined,
        },
      });

      await AuditService.log(
        req.user?.id || null,
        'RECIPIENT_UPDATE',
        `Updated recipient details for ID: ${id}`,
        req.ip
      );

      return res.status(200).json(updated);
    } catch (error) {
      console.error('Update recipient error:', error);
      return res.status(500).json({ error: 'An error occurred updating recipient.' });
    }
  }

  /**
   * Deletes a recipient.
   */
  static async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const companyId = req.user?.companyId || null;

      const recipient = await prisma.recipient.findFirst({
        where: { id, companyId },
      });

      if (!recipient) {
        return res.status(404).json({ error: 'Recipient not found.' });
      }

      await prisma.recipient.delete({ where: { id } });

      await AuditService.log(
        req.user?.id || null,
        'RECIPIENT_DELETE',
        `Deleted recipient email: ${recipient.email}`,
        req.ip
      );

      return res.status(200).json({ message: 'Recipient deleted successfully.' });
    } catch (error) {
      console.error('Delete recipient error:', error);
      return res.status(500).json({ error: 'An error occurred deleting recipient.' });
    }
  }

  /**
   * Bulk action: retries or deletes multiple recipients.
   */
  static async bulkAction(req: AuthenticatedRequest, res: Response) {
    try {
      const { ids, action } = req.body;
      const companyId = req.user?.companyId || null;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Array of recipient IDs is required.' });
      }

      if (action === 'delete') {
        await prisma.recipient.deleteMany({
          where: {
            id: { in: ids },
            companyId,
          },
        });

        await AuditService.log(
          req.user?.id || null,
          'RECIPIENTS_BULK_DELETE',
          `Deleted ${ids.length} recipients.`,
          req.ip
        );

        return res.status(200).json({ message: `Successfully deleted ${ids.length} records.` });
      }

      if (action === 'retry') {
        await prisma.recipient.updateMany({
          where: {
            id: { in: ids },
            companyId,
          },
          data: {
            status: 'QUEUED',
            errorMsg: null,
            retryCount: 0,
          },
        });

        await AuditService.log(
          req.user?.id || null,
          'RECIPIENTS_BULK_RETRY',
          `Queued ${ids.length} recipients for retry.`,
          req.ip
        );

        return res.status(200).json({ message: `Successfully re-queued ${ids.length} records.` });
      }

      return res.status(400).json({ error: 'Invalid bulk action. Allowed: delete, retry' });
    } catch (error) {
      console.error('Bulk action error:', error);
      return res.status(500).json({ error: 'An error occurred during bulk operations.' });
    }
  }
}
