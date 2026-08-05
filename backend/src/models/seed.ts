import bcrypt from 'bcryptjs';
import prisma from './db';

async function main() {
  console.log('Seeding database started...');

  // 1. Create default Company
  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Acme Corporate Solutions Ltd.',
      },
    });
    console.log('Default company created:', company.name);
  }

  // 2. Create default Admin User
  const adminEmail = 'admin@acme.com';
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingUser) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('admin123', salt);

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'Jane Doe (HR Admin)',
        role: 'ADMIN',
        companyId: company.id,
      },
    });
    console.log(`Default Admin created: ${admin.email} / password: admin123`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  // 3. Create default Document Templates
  const offerLetterContent = `Dear {{Name}},

Following our recent discussions, we are delighted to offer you employment with {{Company}} in the position of {{Position}} inside our {{Department}} department.

Your employment will commence on {{JoiningDate}}. In this role, you will report directly to the Head of {{Department}}.

Your starting monthly base compensation will be USD 5,500, paid in accordance with our standard payroll procedures. As a full-time employee, you will also be eligible to participate in our corporate health insurance benefits plan, annual performance bonus structure, and standard paid leave policies.

We are excited about the prospect of you joining our organization. We believe your unique skills, perspective, and dedication will make you a vital contributor to our continued success.

Please review the attached terms and sign this document electronically to confirm your acceptance.`;

  const certificateContent = `This certificate is proudly awarded to {{Name}} for outstanding contributions and performance in the capacity of {{Position}} within the {{Department}} department at {{Company}}.

Your dedication, professionalism, and hard work have been instrumental to our division's achievements. We appreciate your continued efforts and wish you ongoing success in your career journey.`;

  // Upsert Offer Letter Template
  await prisma.template.upsert({
    where: { id: 'offer-letter-template-id' },
    update: {},
    create: {
      id: 'offer-letter-template-id',
      name: 'Standard Professional Offer Letter',
      type: 'OFFER_LETTER',
      content: offerLetterContent,
      designMetadata: {},
    },
  });

  // Upsert Certificate Template
  await prisma.template.upsert({
    where: { id: 'certificate-template-id' },
    update: {},
    create: {
      id: 'certificate-template-id',
      name: 'Award of Excellence Certificate',
      type: 'CERTIFICATE',
      content: certificateContent,
      designMetadata: {},
    },
  });

  // 4. Create default Email Templates
  await prisma.emailTemplate.upsert({
    where: { name: 'Welcome Email Template' },
    update: {},
    create: {
      name: 'Welcome Email Template',
      subject: 'Congratulations & Welcome to {{Company}}! 🎉',
      body: `Dear {{Name}},\n\nCongratulations! We are absolutely thrilled to welcome you to {{Company}} in the position of {{Position}} in the {{Department}} department.\n\nAttached is your official letter for your review. Please sign and return it to us before your joining date: {{JoiningDate}}.\n\nWe look forward to an amazing journey together. Welcome aboard!`,
      signature: 'Best Regards,\nHuman Resources Department\n{{Company}}',
    },
  });

  // 5. Create default Settings
  const settingsCount = await prisma.settings.count();
  if (settingsCount === 0) {
    await prisma.settings.create({
      data: {
        provider: 'SMTP',
        smtpHost: 'sandbox.smtp.mailtrap.io', // Default test environment
        smtpPort: 2525,
        smtpUser: '',
        smtpPass: '',
        defaultFrom: 'hr@acme.com',
      },
    });
    console.log('Default settings created (configured for Mailtrap).');
  }

  console.log('Database seeding successfully finished!');
}

main()
  .catch((e) => {
    console.error('Seeding failure:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
