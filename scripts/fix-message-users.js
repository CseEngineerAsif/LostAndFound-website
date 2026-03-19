const fs = require('fs');
const path = require('path');

require('dotenv').config();

const { init, mongoose } = require('../db');
const { User } = require('../models/user');
const { Message } = require('../models/message');

const seedPath = path.join(__dirname, '..', 'data', 'db.json');

async function fixMessageUsers() {
  const raw = fs.readFileSync(seedPath, 'utf8');
  const parsed = JSON.parse(raw);
  const users = Array.isArray(parsed.users) ? parsed.users : [];

  const idToEmail = new Map();
  users.forEach((u) => {
    if (u && u.id && u.email) {
      idToEmail.set(String(u.id), String(u.email).toLowerCase().trim());
    }
  });

  await init();

  const emailList = Array.from(new Set(Array.from(idToEmail.values())));
  const dbUsers = await User.find({ email: { $in: emailList } }).select('email');
  const emailToUserId = new Map();
  dbUsers.forEach((u) => {
    emailToUserId.set(String(u.email).toLowerCase(), String(u._id));
  });

  const idMap = new Map();
  idToEmail.forEach((email, oldId) => {
    const realId = emailToUserId.get(email);
    if (realId) idMap.set(String(oldId), String(realId));
  });

  let updated = 0;

  for (const [oldId, newId] of idMap.entries()) {
    const res1 = await Message.updateMany({ senderId: String(oldId) }, { $set: { senderId: String(newId) } });
    const res2 = await Message.updateMany({ recipientId: String(oldId) }, { $set: { recipientId: String(newId) } });
    updated += (res1.modifiedCount || res1.nModified || 0) + (res2.modifiedCount || res2.nModified || 0);
  }

  return { updated };
}

fixMessageUsers()
  .then(async (stats) => {
    console.log(`Updated message user ids: ${stats.updated}`);
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
  });
