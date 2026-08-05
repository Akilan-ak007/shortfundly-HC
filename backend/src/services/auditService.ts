import prisma from '../models/db';

export class AuditService {
  static async log(userId: string | null, action: string, details: string, ipAddress?: string) {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          details,
          ipAddress: ipAddress || null,
        },
      });
    } catch (error) {
      console.error('Audit logging failed:', error);
    }
  }
}
