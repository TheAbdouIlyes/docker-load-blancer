# Test Failover Scenario - DB1 Down

## Step-by-Step Failover Test Commands

### Step 1: Check Initial State (Both DBs Running)
```bash
# Check both databases are running
docker ps | findstr "db1 db2"

# Check replication status
docker exec db1 mysql -uroot -prootpassword -e "SHOW SLAVE STATUS\G" | findstr "Slave_IO_Running"
docker exec db2 mysql -uroot -prootpassword -e "SHOW SLAVE STATUS\G" | findstr "Slave_IO_Running"

# Count records in both DBs (should match)
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT COUNT(*) as db1_count FROM users;"
docker exec db2 mysql -uroot -prootpassword voting -e "SELECT COUNT(*) as db2_count FROM users;"
```

### Step 2: Insert Test Data Before Failover
```bash
# Insert a test record into db2 (so we can verify it later)
docker exec db2 mysql -uroot -prootpassword voting -e "INSERT INTO users (username, password) VALUES ('failover_test_user', 'testpass123'); SELECT 'Inserted into DB2' as status, id, username FROM users WHERE username='failover_test_user';"
```

### Step 3: Stop DB1 (Simulate Failure)
```bash
# Stop db1
docker stop db1

# Verify db1 is stopped
docker ps | findstr "db1"
```

### Step 4: Test Backend Still Works (Should Use DB2)
```bash
# Test backend health endpoint
curl http://localhost/health

# Test API endpoint (should work using DB2)
curl http://localhost/api/results

# Try to register a new user (should work with DB2)
curl -X POST http://localhost/api/register -H "Content-Type: application/json" -d "{\"username\":\"failover_user\",\"password\":\"test123\"}"

# Check if the new user was created in DB2
docker exec db2 mysql -uroot -prootpassword voting -e "SELECT * FROM users WHERE username='failover_user';"
```

### Step 5: Verify Data in DB2
```bash
# View all users in DB2 (should have all data)
docker exec db2 mysql -uroot -prootpassword voting -e "SELECT COUNT(*) as total_users FROM users; SELECT * FROM users ORDER BY id;"
```

### Step 6: Restart DB1 (Recovery)
```bash
# Start db1 again
docker start db1

# Wait for db1 to be healthy (about 10-15 seconds)
timeout /t 15

# Check db1 is healthy
docker ps | findstr "db1"
```

### Step 7: Verify Replication Catches Up
```bash
# Wait a few more seconds for replication to sync
timeout /t 5

# Check replication status on db1
docker exec db1 mysql -uroot -prootpassword -e "SHOW SLAVE STATUS\G" | findstr "Slave_IO_Running Slave_SQL_Running Seconds_Behind_Master"

# Verify the failover_test_user appeared in db1 (replicated from db2)
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT * FROM users WHERE username='failover_test_user';"

# Verify the failover_user appeared in db1 (created during failover)
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT * FROM users WHERE username='failover_user';"

# Compare counts - should match now
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT COUNT(*) as db1_count FROM users;"
docker exec db2 mysql -uroot -prootpassword voting -e "SELECT COUNT(*) as db2_count FROM users;"
```

### Step 8: Test Both Directions Again
```bash
# Insert into db1
docker exec db1 mysql -uroot -prootpassword voting -e "INSERT INTO users (username, password) VALUES ('recovery_test', 'pass456');"

# Wait 2 seconds
timeout /t 2

# Check it appeared in db2
docker exec db2 mysql -uroot -prootpassword voting -e "SELECT * FROM users WHERE username='recovery_test';"
```

## Quick One-Liner Test Script

```bash
# Complete test in one go
echo "=== Step 1: Initial State ===" && docker exec db1 mysql -uroot -prootpassword voting -e "SELECT COUNT(*) as db1_users FROM users;" && docker exec db2 mysql -uroot -prootpassword voting -e "SELECT COUNT(*) as db2_users FROM users;" && echo "=== Step 2: Stopping DB1 ===" && docker stop db1 && echo "=== Step 3: Testing with DB2 ===" && docker exec db2 mysql -uroot -prootpassword voting -e "INSERT INTO users (username, password) VALUES ('failover_test', 'test'); SELECT 'Inserted during failover' as status;" && echo "=== Step 4: Restarting DB1 ===" && docker start db1 && timeout /t 20 && echo "=== Step 5: Verifying Replication ===" && docker exec db1 mysql -uroot -prootpassword voting -e "SELECT * FROM users WHERE username='failover_test';"
```

