const fs = require('fs');
const path = require('path');

require('dotenv').config();

const { init, mongoose } = require('../db');
const { User } = require('../models/user');

const seedPath = path.join(__dirname, '..', 'data', 'db.json');

async function importUsers() {
  const raw = fs.readFileSync(seedPath, 'utf8');
  const parsed = JSON.parse(raw);
  const users = Array.isArray(parsed.users) ? parsed.users : [];

  console.log(`Seed users found: ${users.length}`);
  if (!users.length) return { inserted: 0, skipped: 0 };

  await init();

  let inserted = 0;
  let skipped = 0;

  for (const user of users) {
    const email = (user.email || '').toLowerCase().trim();
    if (!email) {
      skipped += 1;
      continue;
    }

    const exists = await User.findOne({ email });
    if (exists) {
      skipped += 1;
      continue;
    }

    await User.create({
      email,
      studentId: user.studentId,
      name: user.name || 'User',
      passwordHash: user.passwordHash,
      role: user.role || 'user',
      createdAt: user.createdAt ? new Date(user.createdAt) : undefined,
    });
    inserted += 1;
  }

  return { inserted, skipped };
}

importUsers()
  .then(async (stats) => {
    console.log(`Inserted: ${stats.inserted}`);
    console.log(`Skipped (already exists or invalid): ${stats.skipped}`);
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
  });
