// db.js
const mysql = require('mysql2/promise');

const DB1 = { host: process.env.DB1_HOST || 'db1', port: process.env.DB1_PORT || 3306, user: 'root', password: 'rootpassword', database: 'voting' };
const DB2 = { host: process.env.DB2_HOST || 'db2', port: process.env.DB2_PORT || 3306, user: 'root', password: 'rootpassword', database: 'voting' };

// Create pools for both DBs with timeout settings for faster failover
const pool1 = mysql.createPool({ 
  ...DB1, 
  waitForConnections: true, 
  connectionLimit: 10,
  connectTimeout: 5000, // 5 second connection timeout
  acquireTimeout: 5000, // 5 second acquire timeout
  timeout: 5000, // 5 second query timeout
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

const pool2 = mysql.createPool({ 
  ...DB2, 
  waitForConnections: true, 
  connectionLimit: 10,
  connectTimeout: 5000,
  acquireTimeout: 5000,
  timeout: 5000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Track which DB is currently available
let db1Available = true;
let db2Available = true;

// Small helper to log DB selection per request
function logDbChoice(dbName, sql) {
  try {
    const host = process.env.HOSTNAME || 'backend';
    const summary = (sql || '').toString().replace(/\s+/g, ' ').trim().slice(0, 140);
    console.log(`[DB] ${host} -> ${dbName} | ${summary}`);
  } catch (e) {
    // ignore logging errors
  }
}

// Helper to check if a pool is available
async function checkPoolHealth(pool, dbName) {
  try {
    const connection = await Promise.race([
      pool.getConnection(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 3000))
    ]);
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    return false;
  }
}

// Helper to try queries on db1 first, fallback to db2
// Returns { rows, dbUsed } where dbUsed is 'db1' or 'db2'
async function queryWithFailover(sql, params = [], options = { write: false }) {
  // PRIMARY: Always try db1 first (master), SECONDARY: db2 (backup)
  // NO round-robin - stick with db1 unless it fails
  const primary = { pool: pool1, name: 'db1' };
  const secondary = { pool: pool2, name: 'db2' };

  try {
    const [rows] = await Promise.race([
      primary.pool.query(sql, params),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${primary.name.toUpperCase()} query timeout`)), 5000))
    ]);
    // mark availability
    if (primary.name === 'db1') db1Available = true; else db2Available = true;
    // log chosen DB
    logDbChoice(primary.name, sql);
    return { rows, dbUsed: primary.name };
  } catch (errPrimary) {
    console.warn(`${primary.name.toUpperCase()} failed:`, errPrimary.message, 'Falling back to', secondary.name);
    // try secondary
    try {
      const [rows] = await Promise.race([
        secondary.pool.query(sql, params),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${secondary.name.toUpperCase()} query timeout`)), 5000))
      ]);
      if (secondary.name === 'db1') db1Available = true; else db2Available = true;
      // mark primary as unavailable since it failed
      if (primary.name === 'db1') db1Available = false; else db2Available = false;
      // log chosen DB (fallback)
      logDbChoice(secondary.name, sql);
      return { rows, dbUsed: secondary.name };
    } catch (errSecondary) {
      // both failed
      if (primary.name === 'db1') db1Available = false; else db2Available = false;
      if (secondary.name === 'db1') db1Available = false; else db2Available = false;
      throw errSecondary;
    }
  }
}

// Periodically check db1 health (every 30 seconds)
setInterval(async () => {
  if (!db1Available) {
    const isHealthy = await checkPoolHealth(pool1, 'db1');
    if (isHealthy) {
      console.log('DB1 is back online!');
      db1Available = true;
    }
  }
}, 30000);

// Get current database status
function getDbStatus() {
  return {
    db1Available,
    db2Available,
    currentDb: db1Available ? 'db1' : (db2Available ? 'db2' : 'none')
  };
}

module.exports = {
  pool1, pool2, queryWithFailover, getDbStatus
};


