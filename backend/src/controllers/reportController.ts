import { Response } from 'express';
import xlsx from 'xlsx';
import PDFDocument from 'pdfkit';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../models/db';

export class ReportController {
  /**
   * Downloads a summary report in CSV, Excel, or PDF format.
   */
  static async download(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = req.user?.companyId || null;
      const format = (req.query.format as string || 'csv').toLowerCase();

      // Retrieve all recipients for the company
      const recipients = await prisma.recipient.findMany({
        where: { companyId },
        include: {
          generatedDocuments: true,
          emailLogs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Map data to clean report structure
      const reportData = recipients.map((r, index) => {
        const lastLog = r.emailLogs[0];
        return {
          'S.No': index + 1,
          'Employee Name': r.name,
          'Email': r.email,
          'Position': r.position,
          'Department': r.department,
          'Joining Date': new Date(r.joiningDate).toLocaleDateString(),
          'Document Type': r.documentType,
          'Status': r.status,
          'Retry Count': r.retryCount,
          'Last Error': r.errorMsg || 'None',
          'Sent Timestamp': lastLog?.sentAt ? new Date(lastLog.sentAt).toLocaleString() : 'N/A',
        };
      });

      // 1. CSV Format
      if (format === 'csv') {
        const headers = Object.keys(reportData[0] || {}).join(',');
        const rows = reportData.map(row => 
          Object.values(row)
            .map(val => `"${String(val).replace(/"/g, '""')}"`)
            .join(',')
        );
        const csvContent = [headers, ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=recipient_delivery_report.csv');
        return res.status(200).send(csvContent);
      }

      // 2. Excel Format (.xlsx)
      if (format === 'xlsx') {
        const worksheet = xlsx.utils.json_to_sheet(reportData);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Delivery Report');
        
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=recipient_delivery_report.xlsx');
        return res.status(200).send(buffer);
      }

      // 3. PDF Format
      if (format === 'pdf') {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=recipient_delivery_report.pdf');
        doc.pipe(res);

        // Header Title
        doc.rect(40, 30, doc.page.width - 80, 6).fill('#0ea5e9');
        doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text('Email Automation Platform', 40, 50);
        doc.font('Helvetica').fontSize(11).fillColor('#64748b').text('Automation Delivery Executive Report', 40, 72);
        
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.font('Helvetica').fontSize(9).text(`Generated: ${dateStr}`, doc.page.width - 160, 55, { align: 'right' });

        doc.moveTo(40, 95).lineTo(doc.page.width - 40, 95).lineWidth(1).stroke('#e2e8f0');

        // Stats Summary Box
        const total = recipients.length;
        const sent = recipients.filter(r => r.status === 'SENT').length;
        const failed = recipients.filter(r => r.status === 'FAILED' || r.status === 'BOUNCED').length;
        const pending = recipients.filter(r => r.status === 'QUEUED' || r.status === 'SENDING').length;

        doc.rect(40, 110, doc.page.width - 80, 50).fill('#f8fafc');
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b').text(`Total Recipients: ${total}`, 60, 120);
        doc.text(`Sent Successfully: ${sent}`, 200, 120);
        doc.text(`Delivery Failures: ${failed}`, 360, 120);
        doc.text(`Pending Dispatch: ${pending}`, 490, 120);

        // Draw Table Header
        let y = 180;
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569');
        doc.text('Name', 45, y);
        doc.text('Email', 160, y);
        doc.text('Department', 320, y);
        doc.text('Document Type', 410, y);
        doc.text('Status', 510, y);

        doc.moveTo(40, y + 15).lineTo(doc.page.width - 40, y + 15).lineWidth(1).stroke('#cbd5e1');
        y += 20;

        // Render rows
        doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
        for (const item of recipients) {
          if (y > doc.page.height - 60) {
            doc.addPage();
            y = 40; // reset y on new page
            // redraw simple table headers
            doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569');
            doc.text('Name', 45, y);
            doc.text('Email', 160, y);
            doc.text('Department', 320, y);
            doc.text('Document Type', 410, y);
            doc.text('Status', 510, y);
            doc.moveTo(40, y + 15).lineTo(doc.page.width - 40, y + 15).lineWidth(1).stroke('#cbd5e1');
            y += 20;
            doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
          }

          const statusColor = item.status === 'SENT' ? '#10b981' : item.status === 'FAILED' ? '#ef4444' : '#f59e0b';
          
          doc.fillColor('#334155');
          // Clip name and email text to prevent overlapping
          doc.text(item.name.substring(0, 20), 45, y, { width: 110 });
          doc.text(item.email.substring(0, 30), 160, y, { width: 150 });
          doc.text(item.department.substring(0, 15), 320, y, { width: 85 });
          doc.text(item.documentType, 410, y, { width: 95 });
          
          doc.fillColor(statusColor);
          doc.text(item.status, 510, y);

          // Draw a soft thin separator line
          doc.moveTo(40, y + 15).lineTo(doc.page.width - 40, y + 15).lineWidth(0.5).stroke('#f1f5f9');
          y += 20;
        }

        doc.end();
        return;
      }

      return res.status(400).json({ error: 'Unsupported report format. Allowed: csv, xlsx, pdf' });
    } catch (error) {
      console.error('Download report error:', error);
      return res.status(500).json({ error: 'An error occurred generating download report.' });
    }
  }
}
