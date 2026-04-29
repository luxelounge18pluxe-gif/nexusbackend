const bcrypt = require('bcryptjs');
const { findUserByEmail: dbFindUserByEmail, findUserById: dbFindUserById, createUser: dbCreateUser, updateUser: dbUpdateUser, sanitizeUser } = require('../config/database');

function sanitizeUserWrapper(user) {
  return sanitizeUser(user);
}

async function getUsers() {
  const db = require('../config/database');
  return db.getUsers();
}

async function findUserByEmail(email) {
  return dbFindUserByEmail(email);
}

async function findUserById(id) {
  return dbFindUserById(id);
}

async function createUser({ name, email, password }) {
  return dbCreateUser({ name, email, password });
}

async function updateUser(id, updates) {
  if (updates.password) {
    const bcrypt = require('bcryptjs');
    updates.passwordHash = await bcrypt.hash(updates.password, 10);
    delete updates.password;
  }
  return dbUpdateUser(id, updates);
}

async function setPasswordResetToken(email) {
  const user = await findUserByEmail(email);
  if (!user) return null;

  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const resetExpires = new Date(Date.now() + 1000 * 60 * 60);
  
  await updateUser(user.id || user._id, { resetToken: token, resetExpires });
  return token;
}

async function resetPassword(token, password) {
  const db = require('../config/database');
  const users = await db.getUsers();
  const user = users.find(
    (item) => item.resetToken === token && item.resetExpires && new Date(item.resetExpires) > new Date()
  );
  if (!user) return null;

  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash(password, 10);
  
  await updateUser(user.id || user._id, { passwordHash, resetToken: null, resetExpires: null });
  return user;
}

module.exports = {
  sanitizeUser: sanitizeUserWrapper,
  getUsers,
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  setPasswordResetToken,
  resetPassword,
};