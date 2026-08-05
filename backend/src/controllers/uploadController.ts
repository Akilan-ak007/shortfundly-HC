import { Response } from 'express';
import xlsx from 'xlsx';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../models/db';
import { AuditService } from '../services/auditService';

interface ParsedRow {
  name: string;
  email: string;
  position: string;
  department: string;
  joiningDate: Date;
  documentType: 'OFFER_LETTER' | 'CERTIFICATE' | 'APPOINTMENT_LETTER' | 'INTERNSHIP_LETTER' | 'RELIEVING_LETTER' | 'EXPERIENCE_LETTER';
  attachmentFileName?: string;
}

export class UploadController {
  /**
   * Uploads and validates an Excel or CSV file.
   * If valid, saves rows as queued Recipients. If invalid, returns lists of structural errors.
   */
  static async upload(req: AuthenticatedRequest, res: Response) {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded. Please upload a .csv or .xlsx file.' });
      }

      // Read spreadsheet buffer via SheetJS
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Parse to JSON array of objects
      const rawRows = xlsx.utils.sheet_to_json<any>(worksheet);

      if (rawRows.length === 0) {
        return res.status(400).json({ error: 'The uploaded file contains no rows.' });
      }

      const errors: Array<{ row: number; name?: string; email?: string; field: string; error: string; value: any }> = [];
      const validRows: ParsedRow[] = [];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const seenEmailsInSheet = new Set<string>();

      // Document type enum mapping helper
      const normalizeDocType = (val: string): any => {
        if (!val) return null;
        const normalized = val.trim().toLowerCase().replace(/[\s_-]+/g, '');
        if (normalized === 'offerletter') return 'OFFER_LETTER';
        if (normalized === 'certificate') return 'CERTIFICATE';
        if (normalized === 'appointmentletter') return 'APPOINTMENT_LETTER';
        if (normalized === 'internshipletter') return 'INTERNSHIP_LETTER';
        if (normalized === 'relievingletter') return 'RELIEVING_LETTER';
        if (normalized === 'experienceletter') return 'EXPERIENCE_LETTER';
        return null;
      };

      // Process each row (1-indexed for user display readability)
      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        const rowNumber = i + 2; // Row 1 is the header

        // Standardize column mappings (allowing case insensitivity and spaces)
        const employeeName = row['Employee Name'] || row['employee_name'] || row['Name'] || row['name'];
        const email = row['Email'] || row['email'] || row['Employee Email'] || row['employee_email'];
        const position = row['Position'] || row['position'] || row['Role'] || row['role'];
        const department = row['Department'] || row['department'] || row['Dept'] || row['dept'];
        const rawJoiningDate = row['Joining Date'] || row['joining_date'] || row['Date'] || row['date'];
        const rawDocType = row['Document Type'] || row['document_type'] || row['Doc Type'] || row['doc_type'];
        const attachmentFileName = row['Attachment File Name'] || row['attachment_file_name'] || row['Attachment'] || row['attachment'];

        // 1. Missing Required Fields validation
        if (!employeeName) {
          errors.push({ row: rowNumber, field: 'Employee Name', error: 'Missing employee name.', value: '' });
        }
        if (!email) {
          errors.push({ row: rowNumber, name: employeeName, field: 'Email', error: 'Missing email address.', value: '' });
        }
        if (!position) {
          errors.push({ row: rowNumber, name: employeeName, email, field: 'Position', error: 'Missing position/title.', value: '' });
        }
        if (!department) {
          errors.push({ row: rowNumber, name: employeeName, email, field: 'Department', error: 'Missing department.', value: '' });
        }
        if (!rawJoiningDate) {
          errors.push({ row: rowNumber, name: employeeName, email, field: 'Joining Date', error: 'Missing joining date.', value: '' });
        }
        if (!rawDocType) {
          errors.push({ row: rowNumber, name: employeeName, email, field: 'Document Type', error: 'Missing document type.', value: '' });
        }

        if (!employeeName || !email || !position || !department || !rawJoiningDate || !rawDocType) {
          continue; // Skip further deep validation for this row as essential details are missing
        }

        const trimmedEmail = String(email).trim().toLowerCase();

        // 2. Invalid Email Format validation
        if (!emailRegex.test(trimmedEmail)) {
          errors.push({ row: rowNumber, name: employeeName, email: trimmedEmail, field: 'Email', error: 'Invalid email address format.', value: email });
        }

        // 3. Duplicate Email in Spreadsheet validation
        if (seenEmailsInSheet.has(trimmedEmail)) {
          errors.push({ row: rowNumber, name: employeeName, email: trimmedEmail, field: 'Email', error: 'Duplicate email address within the uploaded sheet.', value: email });
        } else {
          seenEmailsInSheet.add(trimmedEmail);
        }

        // 4. Validate Joining Date Format
        let parsedDate = new Date(rawJoiningDate);
        if (isNaN(parsedDate.getTime())) {
          // Attempt parsing Excel serial date if parsed as a raw number
          if (typeof rawJoiningDate === 'number') {
            parsedDate = new Date((rawJoiningDate - 25569) * 86400 * 1000);
          }
        }
        if (isNaN(parsedDate.getTime())) {
          errors.push({ row: rowNumber, name: employeeName, email: trimmedEmail, field: 'Joining Date', error: 'Invalid date format.', value: rawJoiningDate });
        }

        // 5. Document Type mapping validation
        const normalizedDoc = normalizeDocType(String(rawDocType));
        if (!normalizedDoc) {
          errors.push({ row: rowNumber, name: employeeName, email: trimmedEmail, field: 'Document Type', error: 'Invalid document type. Allowed: Offer Letter, Certificate, Appointment Letter, Internship Letter, Relieving Letter, Experience Letter.', value: rawDocType });
        }

        if (errors.length === 0) {
          validRows.push({
            name: String(employeeName).trim(),
            email: trimmedEmail,
            position: String(position).trim(),
            department: String(department).trim(),
            joiningDate: parsedDate,
            documentType: normalizedDoc,
            attachmentFileName: attachmentFileName ? String(attachmentFileName).trim() : undefined,
          });
        }
      }

      // If there are structural/validation errors, return them to the client
      if (errors.length > 0) {
        return res.status(422).json({
          isValid: false,
          errorsCount: errors.length,
          errors,
        });
      }

      // If valid, save the recipients into database (marked as QUEUED)
      const companyId = req.user?.companyId || null;
      let insertedCount = 0;

      for (const item of validRows) {
        // Find existing recipient with same email in same company to avoid upsert duplication errors
        const existing = await prisma.recipient.findFirst({
          where: {
            email: item.email,
            companyId,
          },
        });

        if (existing) {
          // Overwrite existing recipient
          await prisma.recipient.update({
            where: { id: existing.id },
            data: {
              name: item.name,
              position: item.position,
              department: item.department,
              joiningDate: item.joiningDate,
              documentType: item.documentType,
              attachmentFileName: item.attachmentFileName || null,
              status: 'QUEUED',
              errorMsg: null,
              retryCount: 0,
            },
          });
        } else {
          // Create new recipient record
          await prisma.recipient.create({
            data: {
              name: item.name,
              email: item.email,
              position: item.position,
              department: item.department,
              joiningDate: item.joiningDate,
              documentType: item.documentType,
              attachmentFileName: item.attachmentFileName || null,
              status: 'QUEUED',
              companyId,
            },
          });
        }
        insertedCount++;
      }

      await AuditService.log(
        req.user?.id || null,
        'RECIPIENTS_UPLOAD',
        `Uploaded spreadsheet successfully. Parsed ${validRows.length} recipients.`,
        req.ip
      );

      return res.status(200).json({
        isValid: true,
        recipientsCount: insertedCount,
        message: `Successfully uploaded and registered ${insertedCount} recipients.`,
      });
    } catch (error) {
      console.error('File upload/parse error:', error);
      return res.status(500).json({ error: 'An error occurred while parsing the uploaded file.' });
    }
  }
}
