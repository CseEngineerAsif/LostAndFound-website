const bcrypt = require('bcrypt');
const db = require('../db');

const SALT_ROUNDS = 12;

async function createUser({ email, studentId, name, password }) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [id] = await db('users').insert({ email, studentId, name, passwordHash });
  return { id, email, studentId, name };
}

async function findByEmail(email) {
  return db('users').where({ email }).first();
}

async function findById(id) {
  return db('users').where({ id }).first();
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
