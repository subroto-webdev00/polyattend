// Creates (or resets) the dedicated E2E admin account before any test runs.
// Idempotent: the same email/password every time, so local runs and CI share
// one fixture without touching real user rows.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

module.exports = async function globalSetup() {
  const email = (process.env.E2E_ADMIN_EMAIL || 'e2e-admin@polyattend.test').toLowerCase();
  const password = process.env.E2E_ADMIN_PASSWORD || 'E2eAdmin!2026';
  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { password: hashed, isActive: true, isVerified: true, role: 'admin' },
    create: {
      name: 'E2E Admin',
      email,
      password: hashed,
      role: 'admin',
      isActive: true,
      isVerified: true,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`🧪 E2E admin ready: ${email}`);
  await prisma.$disconnect();
};
