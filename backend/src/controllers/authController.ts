import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../models/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { AuditService } from '../services/auditService';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

export class AuthController {
  /**
   * Logs in a user, returns a JWT token.
   */
  static async login(req: AuthenticatedRequest, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: { company: true },
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);

      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      await AuditService.log(user.id, 'USER_LOGIN', `Logged in from IP: ${req.ip}`, req.ip);

      return res.status(200).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyName: user.company?.name || null,
        },
      });
    } catch (error: any) {
      console.error('Login error:', error);
      return res.status(500).json({ error: `An error occurred during login: ${error.message || error}` });
    }
  }

  /**
   * Simulates a forgot password request.
   */
  static async forgotPassword(req: AuthenticatedRequest, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
      }

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        // Return 200 for security reasons to hide database records existence
        return res.status(200).json({ message: 'If the email exists, a password reset link has been simulated.' });
      }

      // Generate a temporary new password for ease of test/evaluation
      const tempPass = Math.random().toString(36).substring(2, 10);
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(tempPass, salt);

      await prisma.user.update({
        where: { email },
        data: { passwordHash },
      });

      await AuditService.log(user.id, 'PASSWORD_FORGOT', `Password reset requested. Temp password is: ${tempPass}`, req.ip);

      return res.status(200).json({
        message: `Password reset request successful (SIMULATED). Your temporary password is: ${tempPass}`,
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      return res.status(500).json({ error: 'An error occurred during password reset.' });
    }
  }

  /**
   * Changes the user's password.
   */
  static async changePassword(req: AuthenticatedRequest, res: Response) {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user?.id;

      if (!userId || !oldPassword || !newPassword) {
        return res.status(400).json({ error: 'All fields are required.' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);

      if (!isMatch) {
        return res.status(400).json({ error: 'Incorrect old password.' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      await AuditService.log(userId, 'PASSWORD_CHANGE', 'Password changed successfully.', req.ip);

      return res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
      console.error('Change password error:', error);
      return res.status(500).json({ error: 'An error occurred while changing password.' });
    }
  }

  /**
   * Returns details of the logged in user.
   */
  static async getMe(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { company: true },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyName: user.company?.name || null,
        },
      });
    } catch (error) {
      console.error('Get profile error:', error);
      return res.status(500).json({ error: 'An error occurred fetching profile.' });
    }
  }
}
