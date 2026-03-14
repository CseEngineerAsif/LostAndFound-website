const bcrypt = require('bcryptjs');
const { db } = require('../db');

const SALT_ROUNDS = 12;

function getNextId(list) {
  if (!list.length) return 1;
  return Math.max(...list.map((row) => row.id || 0)) + 1;
}

async function createUser({ email, studentId, name, password }) {
  await db.read();
  db.data = db.data || { users: [], items: [] };

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const id = getNextId(db.data.users);
  const user = { id, email, studentId, name, passwordHash, createdAt: new Date().toISOString() };

  db.data.users.push(user);
  await db.write();

  return { id, email, studentId, name };
}

async function findByEmail(email) {
  await db.read();
  return (db.data?.users || []).find((u) => u.email === email);
}

async function findById(id) {
  await db.read();
  return (db.data?.users || []).find((u) => u.id === id);
}

async function verifyPassword(user, password) {
  if (!user) return false;
  return bcrypt.compare(password, user.passwordHash);
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  verifyPassword,
};
