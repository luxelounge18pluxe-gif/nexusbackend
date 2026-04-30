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
} = require('./model/user');
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
app.use(express.static(path.join(__dirname, '..')));

// Serve frontend pages from the repository root files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
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

app.listen(PORT, () => {
  console.log(`AI Tools backend listening on http://localhost:${PORT}`);
});
