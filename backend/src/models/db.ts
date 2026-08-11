import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

let prisma: any;

if (process.env.DATABASE_URL) {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
} else {
  console.log('DATABASE_URL is not set. Using mock in-memory database Proxy.');
  const mockPasswordHash = bcrypt.hashSync('admin123', 10);
  
  prisma = new Proxy({}, {
    get(target, modelName) {
      if (modelName === '$disconnect') {
        return async () => {};
      }
      return new Proxy({}, {
        get(modelTarget, method) {
          return async function(...args: any[]) {
            const m = String(method);
            const model = String(modelName);
            console.log(`Mocking Prisma: ${model}.${m}`, JSON.stringify(args));
            
            if (model === 'user') {
              if (m === 'findUnique') {
                const email = args[0]?.where?.email;
                if (email === 'admin@acme.com') {
                  return {
                    id: 'mock-admin-id',
                    email: 'admin@acme.com',
                    passwordHash: mockPasswordHash,
                    name: 'Jane Doe (Mock Admin)',
                    role: 'ADMIN',
                    companyId: 'mock-company-id',
                    company: { id: 'mock-company-id', name: 'Acme Corporate Solutions Ltd.' },
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  };
                }
                return null;
              }
            }
            if (model === 'company') {
              if (m === 'findFirst') {
                return { id: 'mock-company-id', name: 'Acme Corporate Solutions Ltd.' };
              }
            }
            if (model === 'settings') {
              if (m === 'findFirst' || m === 'findUnique') {
                return {
                  id: 'mock-settings-id',
                  provider: 'SMTP',
                  smtpHost: 'sandbox.smtp.mailtrap.io',
                  smtpPort: 2525,
                  smtpUser: '',
                  smtpPass: '',
                  defaultFrom: 'hr@acme.com',
                };
              }
              if (m === 'count') return 1;
            }
            if (model === 'recipient') {
              if (m === 'findMany') {
                return [
                  {
                    id: 'mock-rec-1',
                    name: 'John Smith',
                    email: 'john@example.com',
                    position: 'Software Engineer',
                    department: 'Engineering',
                    joiningDate: new Date(),
                    documentType: 'OFFER_LETTER',
                    status: 'QUEUED',
                  }
                ];
              }
              if (m === 'count') return 1;
            }
            
            // Default fallbacks for lists and objects
            if (m.startsWith('findMany') || m === 'list') {
              return [];
            }
            if (m === 'count') {
              return 0;
            }
            return {};
          };
        }
      });
    }
  });
}

export default prisma;
