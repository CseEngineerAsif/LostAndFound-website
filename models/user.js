const bcrypt = require('bcryptjs');
const { mongoose } = require('../db');

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    studentId: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'user' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

async function createUser({ email, studentId, name, password, role = 'user' }) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    email: (email || '').toLowerCase().trim(),
    studentId,
    name,
    passwordHash,
    role,
  });

  return {
    id: user.id,
    email: user.email,
    studentId: user.studentId,
    name: user.name,
    role: user.role,
  };
}

async function findByEmail(email) {
  if (!email) return null;
  return User.findOne({ email: email.toLowerCase().trim() });
}

async function findById(id) {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return null;
  return User.findById(id);
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
  User,
};
