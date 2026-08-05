import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';

interface PDFVariables {
  [key: string]: string;
}

export class PDFService {
  /**
   * Generates a personalized PDF document based on template text and variables.
   * Supports custom themes, signatures, layouts, and QR codes.
   */
  static async generate(
    contentTemplate: string,
    variables: PDFVariables,
    docType: string,
    outputPath: string,
    qrData?: string
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        // Ensure the directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Replace placeholders in the content
        let parsedContent = contentTemplate;
        for (const [key, value] of Object.entries(variables)) {
          const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
          parsedContent = parsedContent.replace(placeholder, value || '');
        }

        // Generate QR code buffer if qrData is provided
        let qrBuffer: Buffer | undefined = undefined;
        if (qrData) {
          try {
            qrBuffer = await QRCode.toBuffer(qrData, { width: 150, margin: 1, type: 'png' });
          } catch (e) {
            console.error('Error generating QR buffer:', e);
          }
        }

        // Decide orientation based on document type
        const isCertificate = docType === 'CERTIFICATE';
        const doc = new PDFDocument({
          size: 'A4',
          layout: isCertificate ? 'landscape' : 'portrait',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
        });

        const writeStream = fs.createWriteStream(outputPath);
        doc.pipe(writeStream);

        if (isCertificate) {
          this.drawCertificate(doc, parsedContent, variables, qrBuffer);
        } else {
          this.drawLetter(doc, parsedContent, variables, docType, qrBuffer);
        }

        doc.end();

        writeStream.on('finish', () => {
          resolve(outputPath);
        });

        writeStream.on('error', (err) => {
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Draws a beautiful landscape Certificate design.
   */
  private static drawCertificate(
    doc: PDFKit.PDFDocument,
    content: string,
    variables: PDFVariables,
    qrBuffer?: Buffer
  ) {
    const width = doc.page.width;
    const height = doc.page.height;

    // Draw dark border
    doc.rect(20, 20, width - 40, height - 40).lineWidth(3).stroke('#1e293b');

    // Draw inner gold border
    doc.rect(26, 26, width - 52, height - 52).lineWidth(1.5).stroke('#d97706');

    // Decorative corner shapes
    doc.rect(20, 20, 30, 30).fill('#1e293b');
    doc.rect(width - 50, 20, 30, 30).fill('#1e293b');
    doc.rect(20, height - 50, 30, 30).fill('#1e293b');
    doc.rect(width - 50, height - 50, 30, 30).fill('#1e293b');

    // Reset fill
    doc.fillColor('#1e293b');

    // Certificate Title
    doc.font('Helvetica-Bold').fontSize(38).fillColor('#0f172a').text('CERTIFICATE OF EXCELLENCE', 0, 75, {
      align: 'center',
    });

    doc.font('Helvetica').fontSize(14).fillColor('#64748b').text('PROUDLY PRESENTED TO', 0, 135, {
      align: 'center',
    });

    // Recipient Name
    const name = variables.Name || variables.EmployeeName || 'Recipient Name';
    doc.font('Helvetica-Bold').fontSize(28).fillColor('#0284c7').text(name, 0, 165, {
      align: 'center',
    });

    // Divider
    doc.moveTo(width / 2 - 120, 210).lineTo(width / 2 + 120, 210).lineWidth(1).stroke('#e2e8f0');

    // Core content body
    doc.font('Helvetica').fontSize(14).fillColor('#334155').text(content, 60, 240, {
      align: 'center',
      width: width - 120,
      lineGap: 6,
    });

    // Draw signatures or dates at the bottom
    const ySign = height - 130;
    
    // Left Signatory (HR / Director)
    doc.moveTo(80, ySign).lineTo(220, ySign).lineWidth(1).stroke('#cbd5e1');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#475569').text('Authorized Signatory', 80, ySign + 8, {
      width: 140,
      align: 'center',
    });

    // Right Date
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.moveTo(width - 220, ySign).lineTo(width - 80, ySign).lineWidth(1).stroke('#cbd5e1');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#475569').text(today, width - 220, ySign + 8, {
      width: 140,
      align: 'center',
    });

    // Embed Verification QR Code in the lower center
    if (qrBuffer) {
      doc.image(qrBuffer, width / 2 - 40, height - 140, { width: 80, height: 80 });
    }
  }

  /**
   * Draws a portrait document layout (Offer Letter, Experience, Relieving, etc.)
   */
  private static drawLetter(
    doc: PDFKit.PDFDocument,
    content: string,
    variables: PDFVariables,
    docType: string,
    qrBuffer?: Buffer
  ) {
    const width = doc.page.width;
    const margin = 50;

    // Sleek header accent bar
    doc.rect(margin, 20, width - margin * 2, 8).fill('#0ea5e9');

    // Corporate Letterhead Header
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text(variables.Company || 'PLATFORM ENTERPRISES', margin, 45);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Automated HR Platform Communication', margin, 65);

    // Document Title
    const title = docType.replace(/_/g, ' ');
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text(title, margin, 110, { align: 'right' });

    // Date
    const dateStr = variables.JoiningDate || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`Date: ${dateStr}`, margin, 140);

    // Recipient block
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b').text('To,', margin, 170);
    doc.font('Helvetica-Bold').fontSize(11).text(variables.Name || 'Employee Name', margin, 185);
    doc.font('Helvetica').fontSize(10).text(`Position: ${variables.Position || 'Staff Member'}`, margin, 200);
    doc.font('Helvetica').fontSize(10).text(`Department: ${variables.Department || 'Operations'}`, margin, 215);

    // Divider line
    doc.moveTo(margin, 235).lineTo(width - margin, 235).lineWidth(1).stroke('#f1f5f9');

    // Main content body
    doc.font('Helvetica').fontSize(11).fillColor('#1e293b').text(content, margin, 255, {
      width: width - margin * 2,
      lineGap: 5,
      align: 'left',
    });

    // Signature Block at the bottom
    doc.text('Sincerely,', margin, doc.y + 40);
    doc.font('Helvetica-Bold').fontSize(11).text('Human Resources Manager', margin, doc.y + 25);
    doc.font('Helvetica').fontSize(9).text(variables.Company || 'Platform Enterprises', margin, doc.y + 4);

    // Embed Verification QR Code in corner for authentication
    if (qrBuffer) {
      doc.image(qrBuffer, width - margin - 70, doc.y - 60, { width: 70, height: 70 });
    }
  }
}
