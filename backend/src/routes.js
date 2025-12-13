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

// Register (requires username, password, and national ID)
router.post('/register', async (req, res) => {
  const { username, password, national_id } = req.body;
  if (!username || !password || !national_id) {
    return res.status(400).json({ error: 'Missing fields. Username, password, and national ID are required.' });
  }
  const hash = await bcrypt.hash(password, 10);
  try {
    const sql = 'INSERT INTO users (username, password, national_id) VALUES (?, ?, ?)';
    const result = await queryWithFailover(sql, [username, hash, national_id], { write: true });
    res.json({ 
      ok: true,
      server: SERVER_ID,
      database: result.dbUsed
    });
  } catch (e) {
    console.error(e);
    if (e.code === 'ER_DUP_ENTRY') {
      if (e.message.includes('national_id')) {
        return res.status(409).json({ error: 'National ID already registered' });
      }
      return res.status(409).json({ error: 'Username already exists' });
    }
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

// Check if user has voted
router.get('/check-vote/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await queryWithFailover(
      'SELECT v.choice, c.name as candidate_name FROM votes v LEFT JOIN candidates c ON v.choice = c.id WHERE v.user_id = ?',
      [userId]
    );
    if (result.rows.length > 0) {
      res.json({ 
        hasVoted: true, 
        votedFor: result.rows[0].candidate_name || `Candidate ${result.rows[0].choice}`,
        server: SERVER_ID,
        database: result.dbUsed
      });
    } else {
      res.json({ 
        hasVoted: false,
        server: SERVER_ID,
        database: result.dbUsed
      });
    }
  } catch (err) {
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

// ============================================
// ADMIN ENDPOINTS
// ============================================

// Admin Login
router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  
  try {
    const result = await queryWithFailover('SELECT id, password FROM admins WHERE username=?', [username]);
    if (!result.rows || result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    
    const admin = result.rows[0];
    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    
    res.json({ 
      id: admin.id,
      username: username,
      role: 'admin',
      server: SERVER_ID,
      database: result.dbUsed
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get all candidates
router.get('/admin/candidates', async (req, res) => {
  try {
    const result = await queryWithFailover('SELECT id, name, description, created_at FROM candidates ORDER BY id');
    res.json({ 
      candidates: result.rows,
      server: SERVER_ID,
      database: result.dbUsed
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Add new candidate (admin only)
router.post('/admin/candidates', async (req, res) => {
  const { admin_id, name, description } = req.body;
  if (!admin_id || !name) return res.status(400).json({ error: 'Missing fields' });
  
  // Verify admin exists
  try {
    const adminCheck = await queryWithFailover('SELECT id FROM admins WHERE id=?', [admin_id]);
    if (!adminCheck.rows || adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const sql = 'INSERT INTO candidates (name, description) VALUES (?, ?)';
    const result = await queryWithFailover(sql, [name, description], { write: true });
    
    res.json({ 
      ok: true,
      message: 'Candidate added successfully',
      server: SERVER_ID,
      database: result.dbUsed
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Candidate already exists' });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Delete candidate (admin only)
router.delete('/admin/candidates/:id', async (req, res) => {
  const { id } = req.params;
  const { admin_id } = req.body;
  
  if (!admin_id) return res.status(400).json({ error: 'Admin ID required' });
  
  // Verify admin exists
  try {
    const adminCheck = await queryWithFailover('SELECT id FROM admins WHERE id=?', [admin_id]);
    if (!adminCheck.rows || adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const sql = 'DELETE FROM candidates WHERE id=?';
    const result = await queryWithFailover(sql, [id], { write: true });
    
    res.json({ 
      ok: true,
      message: 'Candidate deleted successfully',
      server: SERVER_ID,
      database: result.dbUsed
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get voting details - who voted for whom (admin only)
router.post('/admin/vote-details', async (req, res) => {
  const { admin_id } = req.body;
  
  if (!admin_id) return res.status(400).json({ error: 'Admin ID required' });
  
  // Verify admin exists
  try {
    const adminCheck = await queryWithFailover('SELECT id FROM admins WHERE id=?', [admin_id]);
    if (!adminCheck.rows || adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const sql = `
      SELECT 
        u.id as user_id,
        u.username,
        c.id as candidate_id,
        c.name as candidate_name,
        v.created_at
      FROM votes v
      JOIN users u ON v.user_id = u.id
      JOIN candidates c ON v.choice = c.id
      ORDER BY v.created_at DESC
    `;
    
    const result = await queryWithFailover(sql);
    
    res.json({ 
      voteDetails: result.rows,
      server: SERVER_ID,
      database: result.dbUsed
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get voting statistics (admin only)
router.post('/admin/statistics', async (req, res) => {
  const { admin_id } = req.body;
  
  if (!admin_id) return res.status(400).json({ error: 'Admin ID required' });
  
  // Verify admin exists
  try {
    const adminCheck = await queryWithFailover('SELECT id FROM admins WHERE id=?', [admin_id]);
    if (!adminCheck.rows || adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const sql = `
      SELECT 
        c.id,
        c.name,
        COUNT(v.id) as vote_count
      FROM candidates c
      LEFT JOIN votes v ON c.id = v.choice
      GROUP BY c.id, c.name
      ORDER BY vote_count DESC
    `;
    
    const result = await queryWithFailover(sql);
    
    // Calculate total votes
    const totalVotes = result.rows.reduce((sum, row) => sum + (row.vote_count || 0), 0);
    
    res.json({ 
      statistics: result.rows,
      totalVotes: totalVotes,
      server: SERVER_ID,
      database: result.dbUsed
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
