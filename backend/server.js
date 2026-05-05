require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const {
  createUser,
  findUserByEmail,
  findUserById,
  sanitizeUser,
  setPasswordResetToken,
  resetPassword,
  updateUser,
} = require('./model/user');
const auth = require('./middleware/auth');
const toolsRouter = require('./routes/tools');
const transactionRouter = require('./routes/transaction');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// Connect to MongoDB on startup
const { connectDB } = require('./config/database');
connectDB().then(() => {
  console.log('Database initialized');
}).catch(err => {
  console.error('Failed to connect to database:', err.message);
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

function isAdminHost(req) {
  const fullHost = req.headers.host || '';
  const host = fullHost.split(':')[0].toLowerCase();
  
  // Check for admin domain patterns
  const isAdmin = 
    host.includes('admin') ||
    host.includes('nexuxadmin') ||
    host === 'localhost' ||
    process.env.ADMIN_MODE === 'true';
  
  console.log(`[ROUTE] GET / - HOST: "${fullHost}" (${host}) - ADMIN: ${isAdmin}`);
  
  return isAdmin;
}

app.get('/', (req, res) => {
  try {
    if (isAdminHost(req)) {
      const adminPath = path.join(__dirname, '..', 'admin', 'admin.html');
      console.log(`[SERVE] Admin path: ${adminPath}`);
      return res.sendFile(adminPath);
    }
    const indexPath = path.join(__dirname, '..', 'index.html');
    console.log(`[SERVE] Index path: ${indexPath}`);
    return res.sendFile(indexPath);
  } catch (err) {
    console.error(`[ERROR] Route error:`, err.message);
    res.status(500).send('Internal Server Error');
  }
});

app.use(express.static(path.join(__dirname, '..')));

app.get('/index.html', (req, res) => {
  if (isAdminHost(req)) {
    return res.sendFile(path.join(__dirname, '..', 'admin', 'admin.html'));
  }
  return res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/signup.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'signup.html'));
});
app.get('/signin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'signin.html'));
});
app.get('/ai tool.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'ai tool.html'));
});
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin', 'admin.html'));
});
app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});
app.get('/privacy.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'privacy.html'));
});
app.get('/signup', (req, res) => {
  res.redirect('/signup.html');
});
app.get('/signin', (req, res) => {
  res.redirect('/signin.html');
});

app.use('/api/tools', toolsRouter);
app.use('/api/transactions', transactionRouter);

app.get('*', (req, res) => {
  if (isAdminHost(req)) {
    return res.sendFile(path.join(__dirname, '..', 'admin', 'admin.html'));
  }
  return res.sendFile(path.join(__dirname, '..', 'index.html'));
});

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const user = await createUser({ name, email, password });
  const token = createToken(user);
  res.status(201).json({ user: sanitizeUser(user), token });
});

app.post('/api/signin', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  const user = await findUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash || '')) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = createToken(user);
  res.json({ user: sanitizeUser(user), token });
});

app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  const token = await setPasswordResetToken(email);
  if (!token) {
    return res.json({ ok: true, message: 'If account exists, password reset instructions have been sent.' });
  }

  res.json({ ok: true, message: 'Reset token created (development only).', resetToken: token });
});

app.post('/api/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ error: 'Missing token or password' });
  }

  const user = await resetPassword(token, password);
  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  res.json({ ok: true, message: 'Password has been reset' });
});

// ============ Payment Confirmation Routes ============
const fs = require('fs');

function readPayments() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'payments.json'), 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function writePayments(payments) {
  fs.writeFileSync(path.join(__dirname, 'data', 'payments.json'), JSON.stringify(payments, null, 2));
}

function generatePaymentId() {
  return 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// POST /api/payment-confirm - User submits pending payment
app.post('/api/payment-confirm', async (req, res) => {
  try {
    const { method, wallet_address, amount_usd } = req.body || {};
    
    if (!method || !wallet_address || !amount_usd) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user from auth token if available
    let user_email = 'anonymous';
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await findUserById(decoded.id);
        user_email = user?.email || 'unknown';
      } catch (e) {
        // Auth optional for payments
      }
    }

    const payment = {
      id: generatePaymentId(),
      _id: generatePaymentId(), // MongoDB-like ID
      method,
      wallet_address,
      amount_usd: parseFloat(amount_usd),
      user_email,
      user_id: token ? jwt.decode(token)?.id : null,
      status: 'pending_admin_confirmation',
      created_at: new Date().toISOString(),
      confirmed_at: null,
      confirmed_by_admin: null
    };

    const payments = readPayments();
    payments.push(payment);
    writePayments(payments);

    res.status(201).json({ ok: true, message: 'Payment submitted for admin confirmation', payment });
  } catch (error) {
    console.error('Payment submission error:', error);
    res.status(500).json({ error: 'Failed to submit payment' });
  }
});

// GET /api/payment-confirm - Admin retrieves pending payments
app.get('/api/payment-confirm', (req, res) => {
  try {
    const payments = readPayments();
    // Return all payments, sorted by created_at descending
    const sorted = payments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(sorted);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// PATCH /api/payment-confirm/:id - Admin confirms or rejects payment
app.patch('/api/payment-confirm/:id', (req, res) => {
  try {
    const { status } = req.body || {};
    
    if (!status || !['confirmed', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const payments = readPayments();
    const paymentIndex = payments.findIndex(p => p.id === req.params.id || p._id === req.params.id);
    
    if (paymentIndex === -1) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    payments[paymentIndex].status = status;
    payments[paymentIndex].confirmed_at = new Date().toISOString();
    payments[paymentIndex].confirmed_by_admin = 'admin'; // Could store actual admin ID

    writePayments(payments);

    res.json({ ok: true, message: `Payment ${status}`, payment: payments[paymentIndex] });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// ============ User Account Management Routes ============

// POST /api/user/change-password - Change user password
app.post('/api/user/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Missing current or new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    if (!bcrypt.compareSync(currentPassword, user.passwordHash || '')) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update with new password
    const updatedUser = await updateUser(user.id || user._id, { password: newPassword });
    
    res.json({ ok: true, message: 'Password changed successfully', user: sanitizeUser(updatedUser) });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// POST /api/user/delete-account - Delete user account
app.post('/api/user/delete-account', auth, async (req, res) => {
  try {
    const { password } = req.body || {};
    
    if (!password) {
      return res.status(400).json({ error: 'Password required to delete account' });
    }

    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password before deletion
    if (!bcrypt.compareSync(password, user.passwordHash || '')) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Mark user as deleted (soft delete)
    const db = require('./config/database');
    await updateUser(user.id || user._id, { isDeleted: true, deletedAt: new Date().toISOString() });
    
    res.json({ ok: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

app.listen(PORT, () => {
  console.log(`AI Tools backend listening on http://localhost:${PORT}`);
});
