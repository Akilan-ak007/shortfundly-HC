import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../models/db';

export class DashboardController {
  /**
   * Retrieves high-level metric cards data and chart breakdowns.
   */
  static async getStats(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = req.user?.companyId || null;

      // Group recipients by status
      const statusCounts = await prisma.recipient.groupBy({
        by: ['status'],
        where: { companyId },
        _count: {
          id: true,
        },
      });

      let total = 0;
      let sent = 0;
      let pending = 0;
      let failed = 0;

      statusCounts.forEach((group) => {
        const count = group._count.id;
        total += count;
        if (group.status === 'SENT') {
          sent += count;
        } else if (group.status === 'QUEUED' || group.status === 'SENDING') {
          pending += count;
        } else if (group.status === 'FAILED' || group.status === 'BOUNCED') {
          failed += count;
        }
      });

      // Calculate success rate
      const completed = sent + failed;
      const successRate = completed > 0 ? Math.round((sent / completed) * 100) : 100;

      // Fetch today's emails count
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const todaysEmails = await prisma.emailLog.count({
        where: {
          recipient: { companyId },
          status: 'SENT',
          sentAt: {
            gte: startOfToday,
          },
        },
      });

      // Get monthly email sending trends for charts (last 6 months)
      const chartData = await DashboardController.getSendingTrends(companyId);

      // Get department email distributions for charts
      const deptDistribution = await prisma.recipient.groupBy({
        by: ['department'],
        where: { companyId },
        _count: {
          id: true,
        },
      });
      const departmentData = deptDistribution.map(d => ({
        name: d.department,
        value: d._count.id,
      }));

      return res.status(200).json({
        metrics: {
          totalEmployees: total,
          emailsSent: sent,
          pending,
          failed,
          successRate,
          todaysEmails,
        },
        charts: {
          trends: chartData,
          departments: departmentData,
        },
      });
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      return res.status(500).json({ error: 'An error occurred fetching dashboard metrics.' });
    }
  }

  /**
   * Retrieves the 10 most recent activity logs.
   */
  static async getRecentActivity(req: AuthenticatedRequest, res: Response) {
    try {
      const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      const formatted = logs.map((log) => ({
        id: log.id,
        userName: log.user?.name || 'System',
        userEmail: log.user?.email || 'system@platform.com',
        action: log.action,
        details: log.details,
        timestamp: log.createdAt,
      }));

      return res.status(200).json(formatted);
    } catch (error) {
      console.error('Get recent activity error:', error);
      return res.status(500).json({ error: 'An error occurred fetching activity logs.' });
    }
  }

  /**
   * Helper to retrieve monthly email dispatch trends.
   */
  private static async getSendingTrends(companyId: string | null) {
    // Generate dates for the last 6 months
    const trends = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth();

      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const [sentCount, failedCount] = await Promise.all([
        prisma.emailLog.count({
          where: {
            recipient: { companyId },
            status: 'SENT',
            sentAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
        }),
        prisma.emailLog.count({
          where: {
            recipient: { companyId },
            status: 'FAILED',
            createdAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
        }),
      ]);

      const monthName = date.toLocaleString('en-US', { month: 'short' });
      trends.push({
        month: monthName,
        Sent: sentCount,
        Failed: failedCount,
      });
    }
    return trends;
  }
}
