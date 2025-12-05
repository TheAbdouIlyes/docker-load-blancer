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
  // Try db1 first if we think it's available
  if (db1Available) {
    try {
      const [rows] = await Promise.race([
        pool1.query(sql, params),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB1 query timeout')), 5000))
      ]);
      return { rows, dbUsed: 'db1' };
    } catch (e1) {
      console.warn('DB1 failed:', e1.message, 'Trying DB2...');
      db1Available = false; // Mark db1 as unavailable
      
      // Try db2
      try {
        const [rows] = await Promise.race([
          pool2.query(sql, params),
          new Promise((_, reject) => setTimeout(() => reject(new Error('DB2 query timeout')), 5000))
        ]);
        db2Available = true; // Mark db2 as available
        return { rows, dbUsed: 'db2' };
      } catch (e2) {
        console.error('DB2 failed too:', e2.message);
        db2Available = false;
        throw e2;
      }
    }
  } else {
    // db1 is marked as unavailable, try db2 directly
    try {
      const [rows] = await Promise.race([
        pool2.query(sql, params),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB2 query timeout')), 5000))
      ]);
      db2Available = true;
      return { rows, dbUsed: 'db2' };
    } catch (e2) {
      console.error('DB2 failed:', e2.message);
      db2Available = false;
      
      // Last resort: try db1 again in case it recovered
      try {
        const [rows] = await Promise.race([
          pool1.query(sql, params),
          new Promise((_, reject) => setTimeout(() => reject(new Error('DB1 query timeout')), 5000))
        ]);
        db1Available = true; // db1 recovered
        return { rows, dbUsed: 'db1' };
      } catch (e1) {
        throw e2; // Throw the db2 error
      }
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


