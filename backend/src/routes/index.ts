import { Router } from 'express';
import multer from 'multer';
import { authenticateJWT, requireAdmin } from '../middleware/auth';
import { AuthController } from '../controllers/authController';
import { UploadController } from '../controllers/uploadController';
import { RecipientController } from '../controllers/recipientController';
import { TemplateController } from '../controllers/templateController';
import { AutomationController } from '../controllers/automationController';
import { DashboardController } from '../controllers/dashboardController';
import { ReportController } from '../controllers/reportController';
import { SettingsController } from '../controllers/settingsController';

const router = Router();

// Configure multer file upload in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB maximum file size
});

// ==========================================
// Authentication Routes
// ==========================================
router.post('/auth/login', AuthController.login);
router.post('/auth/forgot-password', AuthController.forgotPassword);
router.get('/auth/me', authenticateJWT, AuthController.getMe);
router.post('/auth/change-password', authenticateJWT, AuthController.changePassword);

// ==========================================
// Spreadsheet Upload Routes
// ==========================================
router.post('/upload', authenticateJWT, upload.single('file'), UploadController.upload);

// ==========================================
// Recipients CRUD Routes
// ==========================================
router.get('/recipients', authenticateJWT, RecipientController.list);
router.post('/recipients', authenticateJWT, RecipientController.create);
router.put('/recipients/:id', authenticateJWT, RecipientController.update);
router.delete('/recipients/clear', authenticateJWT, RecipientController.clearAll);
router.delete('/recipients/:id', authenticateJWT, RecipientController.delete);
router.post('/recipients/bulk', authenticateJWT, RecipientController.bulkAction);

// ==========================================
// Document & Email Template Routes
// ==========================================
// Doc Templates
router.get('/templates/doc', authenticateJWT, TemplateController.listDocTemplates);
router.post('/templates/doc', authenticateJWT, TemplateController.createDocTemplate);
router.put('/templates/doc/:id', authenticateJWT, TemplateController.updateDocTemplate);
router.delete('/templates/doc/:id', authenticateJWT, TemplateController.deleteDocTemplate);
router.post('/templates/upload-bg', authenticateJWT, upload.single('file'), TemplateController.uploadBackground);

// Email Templates
router.get('/templates/email', authenticateJWT, TemplateController.listEmailTemplates);
router.post('/templates/email', authenticateJWT, TemplateController.createEmailTemplate);
router.put('/templates/email/:id', authenticateJWT, TemplateController.updateEmailTemplate);
router.delete('/templates/email/:id', authenticateJWT, TemplateController.deleteEmailTemplate);

// AI Helper Utilities
router.post('/templates/ai/generate-email', authenticateJWT, TemplateController.aiGenerateEmail);
router.post('/templates/ai/suggest-subject', authenticateJWT, TemplateController.aiSuggestSubject);
router.get('/templates/ai/detect-anomalies', authenticateJWT, TemplateController.aiDetectAnomalies);
router.get('/templates/ai/sending-time', authenticateJWT, TemplateController.aiRecommendTime);

// ==========================================
// Automation Controls
// ==========================================
router.post('/automation/start', authenticateJWT, AutomationController.start);
router.get('/automation/progress', authenticateJWT, AutomationController.getProgress);

// ==========================================
// Dashboard Stats
// ==========================================
router.get('/dashboard/stats', authenticateJWT, DashboardController.getStats);
router.get('/dashboard/recent-activity', authenticateJWT, DashboardController.getRecentActivity);

// ==========================================
// Reports Export
// ==========================================
router.get('/reports/download', authenticateJWT, ReportController.download);

// ==========================================
// Settings Management
// ==========================================
router.get('/settings', authenticateJWT, SettingsController.getSettings);
router.post('/settings', authenticateJWT, requireAdmin, SettingsController.saveSettings);
router.post('/settings/test', authenticateJWT, requireAdmin, SettingsController.testConnection);
router.get('/settings/company', authenticateJWT, SettingsController.getCompany);
router.put('/settings/company', authenticateJWT, requireAdmin, SettingsController.saveCompany);

export default router;
