const { readJson, writeJson, TRANSACTIONS_FILE } = require('../config/database');

function getTransactions() {
  return readJson(TRANSACTIONS_FILE);
}

function findTransactionById(id) {
  if (!id) return null;
  return getTransactions().find((transaction) => String(transaction.id) === String(id));
}

function findTransactionsByUser(userId) {
  return getTransactions().filter((transaction) => String(transaction.userId) === String(userId));
}

function createTransaction({ userId, toolId, amount, quantity = 1, status = 'pending' }) {
  const transactions = getTransactions();
  const newTransaction = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    userId,
    toolId,
    amount,
    quantity,
    status,
    createdAt: new Date().toISOString(),
  };

  transactions.push(newTransaction);
  writeJson(TRANSACTIONS_FILE, transactions);
  return newTransaction;
}

function updateTransaction(id, updates) {
  const transactions = getTransactions();
  const index = transactions.findIndex((transaction) => String(transaction.id) === String(id));
  if (index === -1) return null;

  transactions[index] = { ...transactions[index], ...updates };
  writeJson(TRANSACTIONS_FILE, transactions);
  return transactions[index];
}

function deleteTransaction(id) {
  const transactions = getTransactions();
  const index = transactions.findIndex((transaction) => String(transaction.id) === String(id));
  if (index === -1) return null;

  const [removed] = transactions.splice(index, 1);
  writeJson(TRANSACTIONS_FILE, transactions);
  return removed;
}

module.exports = {
  getTransactions,
  findTransactionById,
  findTransactionsByUser,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
