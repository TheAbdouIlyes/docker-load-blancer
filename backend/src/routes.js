// routes.js
const express = require('express');
const bcrypt = require('bcrypt');
const { queryWithFailover, getDbStatus } = require('./db');

const router = express.Router();

// Get server ID from container name or environment
const SERVER_ID = process.env.SERVER_ID || ((process.env.HOSTNAME || 'backend').includes('backend2') ? 'Server 2' : 'Server 1');

/**
 * Basic login/register endpoints for demo purposes only.
 * For simplicity, use username & password (no tokens) — store cookieless flows.
 */

// health check with server/db info
router.get('/health', (req, res) => {
  const dbStatus = getDbStatus();
  res.json({ 
    status: 'ok',
    server: SERVER_ID,
    database: dbStatus.currentDb,
    db1Available: dbStatus.db1Available,
    db2Available: dbStatus.db2Available
  });
});

// Register (for creating test users)
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
    const result = await queryWithFailover(sql, [username, hash], { write: true });
    res.json({ 
      ok: true,
      server: SERVER_ID,
      database: result.dbUsed
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Login (very simple — returns user id)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await queryWithFailover('SELECT id, password FROM users WHERE username=?', [username]);
  if (!result.rows || result.rows.length === 0) return res.status(401).json({ error: 'Invalid' });
  const user = result.rows[0];
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid' });
  res.json({ 
    id: user.id,
    server: SERVER_ID,
    database: result.dbUsed
  });
});

// Submit vote
router.post('/vote', async (req, res) => {
  const { user_id, choice } = req.body;
  if (!user_id || !choice) return res.status(400).json({ error: 'Missing fields' });

  // Use transaction to ensure atomic insert - try DB1 then fallback
  const sql = 'INSERT INTO votes (user_id, choice) VALUES (?, ?)';
  try {
    const result = await queryWithFailover(sql, [user_id, choice], { write: true });
    res.json({ 
      ok: true,
      server: SERVER_ID,
      database: result.dbUsed
    });
  } catch (err) {
    // Duplicate user (unique constraint) -> user already voted
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'User already voted' });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Results
router.get('/results', async (req, res) => {
  const result = await queryWithFailover('SELECT choice, COUNT(*) as cnt FROM votes GROUP BY choice');
  res.json({ 
    results: result.rows,
    server: SERVER_ID,
    database: result.dbUsed
  });
});

module.exports = router;
