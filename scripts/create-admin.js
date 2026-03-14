const bcrypt = require('bcryptjs');
const { init, db } = require('../db');

const SALT_ROUNDS = 12;

async function createOrUpdateAdmin() {
  await init();
  await db.read();

  db.data = db.data || { users: [], items: [] };

  const email = process.env.ADMIN_EMAIL || 'admin@campusfind.local';
  const password = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const name = process.env.ADMIN_NAME || 'Campus Admin';
  const studentId = process.env.ADMIN_STUDENT_ID || 'ADMIN-0001';

  const existing = (db.data.users || []).find((u) => u.email === email);
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  if (existing) {
    existing.name = name;
    existing.studentId = studentId;
    existing.role = 'admin';
    if (process.env.ADMIN_PASSWORD) {
      existing.passwordHash = passwordHash;
    }
    await db.write();
    console.log(`Updated admin account: ${email}`);
    return;
  }

  const id = db.data.users.length
    ? Math.max(...db.data.users.map((row) => row.id || 0)) + 1
    : 1;

  db.data.users.push({
    id,
    email,
    studentId,
    name,
    passwordHash,
    role: 'admin',
    createdAt: new Date().toISOString(),
  });

  await db.write();
  console.log(`Created admin account: ${email}`);
}

createOrUpdateAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
