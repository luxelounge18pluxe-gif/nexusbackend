const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const DATA_DIR = path.join(__dirname, '..', 'data');
const TOOLS_FILE = path.join(DATA_DIR, 'tools.json');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
      return [];
    }
    const json = fs.readFileSync(filePath, 'utf8');
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error(`Failed to read JSON file ${filePath}:`, error);
    return [];
  }
}

function writeJson(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Failed to write JSON file ${filePath}:`, error);
    throw error;
  }
}

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/aitools';
const DB_NAME = 'aitools';

let client = null;
let db = null;

async function connectDB() {
  if (db) return db;
  
  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(DB_NAME);
    
    // Create indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('tools').createIndex({ id: 1 });
    await db.collection('transactions').createIndex({ userId: 1 });
    
    console.log('Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
}

function getDB() {
  if (!db) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return db;
}

// User functions
async function getUsers() {
  const db = getDB();
  return db.collection('users').find({}).toArray();
}

async function findUserByEmail(email) {
  if (!email) return null;
  const db = getDB();
  return db.collection('users').findOne({ email: String(email).toLowerCase() });
}

async function findUserById(id) {
  if (!id) return null;
  const db = getDB();
  try {
    return db.collection('users').findOne({ _id: new ObjectId(id) });
  } catch {
    return db.collection('users').findOne({ id: String(id) });
  }
}

async function createUser({ name, email, password }) {
  const db = getDB();
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash(password, 10);
  
  const users = await db.collection('users').find({}).toArray();
  const newUser = {
    id: String(Date.now()),
    name,
    email: String(email).toLowerCase(),
    passwordHash,
    createdAt: new Date().toISOString()
  };
  
  await db.collection('users').insertOne(newUser);
  return newUser;
}

async function updateUser(id, updates) {
  const db = getDB();
  try {
    return db.collection('users').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updates },
      { returnDocument: 'after' }
    );
  } catch {
    return db.collection('users').findOneAndUpdate(
      { id: String(id) },
      { $set: updates },
      { returnDocument: 'after' }
    );
  }
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, resetToken, resetExpires, ...safeUser } = user;
  return safeUser;
}

// Tool functions
async function getTools() {
  const db = getDB();
  return db.collection('tools').find({}).toArray();
}

async function findToolById(id) {
  const db = getDB();
  return db.collection('tools').findOne({ id: String(id) });
}

async function saveTool(tool) {
  const db = getDB();
  await db.collection('tools').updateOne(
    { id: tool.id },
    { $set: tool },
    { upsert: true }
  );
  return tool;
}

// Transaction functions
async function getTransactions() {
  const db = getDB();
  return db.collection('transactions').find({}).toArray();
}

async function getTransactionsByUserId(userId) {
  const db = getDB();
  return db.collection('transactions').find({ userId: String(userId) }).toArray();
}

async function createTransaction(transaction) {
  const db = getDB();
  const tx = {
    ...transaction,
    createdAt: new Date().toISOString()
  };
  await db.collection('transactions').insertOne(tx);
  return tx;
}

module.exports = {
  readJson,
  writeJson,
  TOOLS_FILE,
  TRANSACTIONS_FILE,
  USERS_FILE,
  connectDB,
  getDB,
  getUsers,
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  sanitizeUser,
  getTools,
  findToolById,
  saveTool,
  getTransactions,
  getTransactionsByUserId,
  createTransaction,
  ObjectId
};
