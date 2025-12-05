# How to Check Master-Master Replication

## Quick Status Check

### 1. Check Replication Status on Both Databases

```bash
# Check db1 replication status
docker exec db1 mysql -uroot -prootpassword -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Seconds_Behind_Master|Last_IO_Error|Last_SQL_Error)"

# Check db2 replication status
docker exec db2 mysql -uroot -prootpassword -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Seconds_Behind_Master|Last_IO_Error|Last_SQL_Error)"
```

**Expected Output:**
- `Slave_IO_Running: Yes`
- `Slave_SQL_Running: Yes`
- `Seconds_Behind_Master: 0` (or a small number)
- No errors

### 2. Test Bidirectional Replication

```bash
# Insert data into db1
docker exec db1 mysql -uroot -prootpassword voting -e "INSERT INTO users (username, password) VALUES ('test_from_db1', 'pass123');"

# Check if it appears in db2 (should appear within seconds)
docker exec db2 mysql -uroot -prootpassword voting -e "SELECT * FROM users WHERE username='test_from_db1';"

# Insert data into db2
docker exec db2 mysql -uroot -prootpassword voting -e "INSERT INTO users (username, password) VALUES ('test_from_db2', 'pass456');"

# Check if it appears in db1 (should appear within seconds)
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT * FROM users WHERE username='test_from_db2';"
```

### 3. Check Master Status (Both databases should be masters)

```bash
# Check db1 master status
docker exec db1 mysql -uroot -prootpassword -e "SHOW MASTER STATUS\G"

# Check db2 master status
docker exec db2 mysql -uroot -prootpassword -e "SHOW MASTER STATUS\G"
```

### 4. View All Data in Both Databases (Should Match)

```bash
# Count records in db1
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT COUNT(*) as total_users FROM users;"

# Count records in db2
docker exec db2 mysql -uroot -prootpassword voting -e "SELECT COUNT(*) as total_users FROM users;"

# View all users in db1
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT * FROM users ORDER BY id;"

# View all users in db2 (should match db1)
docker exec db2 mysql -uroot -prootpassword voting -e "SELECT * FROM users ORDER BY id;"
```

### 5. Check GTID Positions

```bash
# Check GTID positions
docker exec db1 mysql -uroot -prootpassword -e "SELECT @@gtid_current_pos, @@gtid_slave_pos;"
docker exec db2 mysql -uroot -prootpassword -e "SELECT @@gtid_current_pos, @@gtid_slave_pos;"
```

### 6. Test Failover Scenario

```bash
# Stop db1
docker stop db1

# Try to insert into db2 (should work)
docker exec db2 mysql -uroot -prootpassword voting -e "INSERT INTO users (username, password) VALUES ('test_failover', 'pass789');"

# Start db1 again
docker start db1

# Wait a few seconds for replication to catch up
sleep 5

# Check if the data from db2 appeared in db1
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT * FROM users WHERE username='test_failover';"
```

### 7. Check Load Balancer

```bash
# Check HAProxy status
docker exec haproxy cat /var/run/haproxy.stat 2>/dev/null || echo "Stats not enabled"

# Check which backend is handling requests
curl http://localhost/health
```

### 8. Monitor Replication in Real-Time

```bash
# Watch replication status (run this in a separate terminal)
watch -n 2 'docker exec db1 mysql -uroot -prootpassword -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Seconds_Behind_Master)"'
```

### 9. Check All Services Status

```bash
docker-compose ps
```

All services should show "Up" status, and db1/db2 should show "(healthy)".

### 10. View Replication Setup Logs

```bash
docker logs replication-setup
```

This shows the initial replication setup and any errors.

