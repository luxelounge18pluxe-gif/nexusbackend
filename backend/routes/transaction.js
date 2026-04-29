const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createTransaction,
  findTransactionById,
  findTransactionsByUser,
  updateTransaction,
  deleteTransaction,
} = require('../model/transaction');

router.use(auth);

router.get('/', (req, res) => {
  const transactions = findTransactionsByUser(req.user.id);
  res.json(transactions);
});

router.get('/:id', (req, res) => {
  const transaction = findTransactionById(req.params.id);
  if (!transaction || String(transaction.userId) !== String(req.user.id)) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  res.json(transaction);
});

router.post('/', (req, res) => {
  const { toolId, amount, quantity } = req.body || {};
  if (!toolId || amount == null) {
    return res.status(400).json({ error: 'toolId and amount are required' });
  }

  const transaction = createTransaction({
    userId: req.user.id,
    toolId,
    amount,
    quantity: quantity || 1,
  });

  res.status(201).json(transaction);
});

router.patch('/:id', (req, res) => {
  const transaction = findTransactionById(req.params.id);
  if (!transaction || String(transaction.userId) !== String(req.user.id)) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const updated = updateTransaction(req.params.id, req.body);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const transaction = findTransactionById(req.params.id);
  if (!transaction || String(transaction.userId) !== String(req.user.id)) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const removed = deleteTransaction(req.params.id);
  res.json(removed);
});

module.exports = router;
