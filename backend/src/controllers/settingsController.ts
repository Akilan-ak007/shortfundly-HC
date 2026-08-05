import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../models/db';
import { EmailService } from '../services/emailService';
import { AuditService } from '../services/auditService';

export class SettingsController {
  /**
   * Retrieves email configuration settings (redacting passwords).
   */
  static async getSettings(req: AuthenticatedRequest, res: Response) {
    try {
      let settings = await prisma.settings.findFirst();

      if (!settings) {
        // Create initial default settings
        settings = await prisma.settings.create({
          data: {
            provider: 'SMTP',
            defaultFrom: 'no-reply@company.com',
          },
        });
      }

      // Redact sensitive credentials before sending to client
      const redactedSettings = {
        id: settings.id,
        provider: settings.provider,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpUser: settings.smtpUser,
        defaultFrom: settings.defaultFrom,
        hasSmtpPass: !!settings.smtpPass,
        apiKeys: settings.apiKeys || {},
      };

      return res.status(200).json(redactedSettings);
    } catch (error) {
      console.error('Get settings error:', error);
      return res.status(500).json({ error: 'An error occurred fetching settings.' });
    }
  }

  /**
   * Creates or updates configuration settings.
   */
  static async saveSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const { provider, smtpHost, smtpPort, smtpUser, smtpPass, defaultFrom, apiKeys } = req.body;

      if (!provider || !defaultFrom) {
        return res.status(400).json({ error: 'Provider and default sender email are required.' });
      }

      let settings = await prisma.settings.findFirst();

      const dataToSave: any = {
        provider: provider.trim(),
        smtpHost: smtpHost ? smtpHost.trim() : null,
        smtpPort: smtpPort ? parseInt(smtpPort) : null,
        smtpUser: smtpUser ? smtpUser.trim() : null,
        defaultFrom: defaultFrom.trim(),
        apiKeys: apiKeys || {},
      };

      // Only overwrite password if a new one is explicitly provided
      if (smtpPass) {
        dataToSave.smtpPass = smtpPass.trim();
      }

      if (settings) {
        settings = await prisma.settings.update({
          where: { id: settings.id },
          data: dataToSave,
        });
      } else {
        settings = await prisma.settings.create({
          data: dataToSave,
        });
      }

      await AuditService.log(
        req.user?.id || null,
        'SETTINGS_SAVE',
        `Saved settings. Active Provider: ${provider}`,
        req.ip
      );

      return res.status(200).json({
        message: 'Settings saved successfully.',
        settings: {
          id: settings.id,
          provider: settings.provider,
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpUser: settings.smtpUser,
          defaultFrom: settings.defaultFrom,
          hasSmtpPass: !!settings.smtpPass,
          apiKeys: settings.apiKeys || {},
        },
      });
    } catch (error) {
      console.error('Save settings error:', error);
      return res.status(500).json({ error: 'An error occurred saving settings.' });
    }
  }

  /**
   * Tests the connection with current settings.
   */
  static async testConnection(req: AuthenticatedRequest, res: Response) {
    try {
      const success = await EmailService.verifyConnection();
      if (success) {
        return res.status(200).json({ message: 'SMTP credentials verified successfully! Connection established.' });
      } else {
        return res.status(400).json({ error: 'SMTP connection failed. Check your credentials and server configurations.' });
      }
    } catch (error: any) {
      console.error('Test SMTP connection error:', error);
      return res.status(500).json({ error: error.message || 'An error occurred testing SMTP server connection.' });
    }
  }

  /**
   * Retrieves the current user's company information.
   */
  static async getCompany(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(400).json({ error: 'No company associated with this user.' });
      }

      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        return res.status(404).json({ error: 'Company not found.' });
      }

      return res.status(200).json(company);
    } catch (error) {
      console.error('Get company error:', error);
      return res.status(500).json({ error: 'An error occurred fetching company details.' });
    }
  }

  /**
   * Updates company name.
   */
  static async saveCompany(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      const { name } = req.body;

      if (!companyId) {
        return res.status(400).json({ error: 'No company associated with this user.' });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Company name is required.' });
      }

      const updated = await prisma.company.update({
        where: { id: companyId },
        data: { name: name.trim() },
      });

      await AuditService.log(
        req.user?.id || null,
        'COMPANY_SAVE',
        `Updated company name to: ${updated.name}`,
        req.ip
      );

      return res.status(200).json({
        message: 'Company profile updated successfully.',
        company: updated,
      });
    } catch (error) {
      console.error('Save company error:', error);
      return res.status(500).json({ error: 'An error occurred updating company profile.' });
    }
  }
}
