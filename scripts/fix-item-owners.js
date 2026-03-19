const fs = require('fs');
const path = require('path');

require('dotenv').config();

const { init, mongoose } = require('../db');
const { User } = require('../models/user');
const { Item } = require('../models/item');

const seedPath = path.join(__dirname, '..', 'data', 'db.json');

async function fixItemOwners() {
  const raw = fs.readFileSync(seedPath, 'utf8');
  const parsed = JSON.parse(raw);
  const users = Array.isArray(parsed.users) ? parsed.users : [];
  const items = Array.isArray(parsed.items) ? parsed.items : [];

  const idToEmail = new Map();
  users.forEach((u) => {
    if (u && u.id && u.email) {
      idToEmail.set(String(u.id), String(u.email).toLowerCase().trim());
    }
  });

  await init();

  const emailToUserId = new Map();
  const emailList = Array.from(new Set(Array.from(idToEmail.values())));
  const dbUsers = await User.find({ email: { $in: emailList } }).select('email');
  dbUsers.forEach((u) => {
    emailToUserId.set(String(u.email).toLowerCase(), String(u._id));
  });

  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const seedOwnerId = item && item.userId ? String(item.userId) : null;
    if (!seedOwnerId) {
      skipped += 1;
      continue;
    }
    const email = idToEmail.get(seedOwnerId);
    if (!email) {
      skipped += 1;
      continue;
    }
    const realUserId = emailToUserId.get(email);
    if (!realUserId) {
      skipped += 1;
      continue;
    }

    const result = await Item.updateMany(
      { userId: seedOwnerId },
      { $set: { userId: String(realUserId) } }
    );

    if (result && (result.modifiedCount || result.nModified)) {
      updated += result.modifiedCount || result.nModified || 0;
    }
  }

  return { updated, skipped };
}

fixItemOwners()
  .then(async (stats) => {
    console.log(`Updated items: ${stats.updated}`);
    console.log(`Skipped mappings: ${stats.skipped}`);
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
  });
