# Complete System Test - Manual Commands

Run these commands in order to test your complete system:

## TEST 1: Check All Services Are Running
```powershell
docker ps --format "table {{.Names}}\t{{.Status}}" | findstr "frontend haproxy backend db"
```
**Expected:** All services should show "Up" status

---

## TEST 2: Test Frontend -> Load Balancer -> Backend
```powershell
Invoke-WebRequest -Uri http://localhost/health -UseBasicParsing | Select-Object -ExpandProperty Content
```
**Expected:** Should return "OK"

---

## TEST 3: Test Load Balancer Distribution
```powershell
# Make 5 requests to see load balancing
1..5 | ForEach-Object { Invoke-WebRequest -Uri http://localhost/health -UseBasicParsing | Select-Object -ExpandProperty Content; Start-Sleep -Milliseconds 500 }
```
**Expected:** All should return "OK" (requests distributed between backend1 and backend2)

---

## TEST 4: Test Backend Server Failover
```powershell
# Stop backend1
docker stop backend

# Test health endpoint (should still work using backend2)
Invoke-WebRequest -Uri http://localhost/health -UseBasicParsing | Select-Object -ExpandProperty Content

# Restart backend1
docker start backend
Start-Sleep -Seconds 3
```
**Expected:** Health check should still return "OK" even when backend1 is down

---

## TEST 5: Check Master-Master Replication Status
```powershell
# Check DB1 replication
docker exec db1 mysql -uroot -prootpassword -e "SHOW SLAVE STATUS\G" | findstr "Slave_IO_Running Slave_SQL_Running"

# Check DB2 replication
docker exec db2 mysql -uroot -prootpassword -e "SHOW SLAVE STATUS\G" | findstr "Slave_IO_Running Slave_SQL_Running"
```
**Expected:** Both should show "Slave_IO_Running: Yes" and "Slave_SQL_Running: Yes"

---

## TEST 6: Test Database Failover (DB1 Down -> Use DB2)
```powershell
# Get current user count
docker exec db2 mysql -uroot -prootpassword voting -e "SELECT COUNT(*) as users FROM users;"

# Stop DB1
docker stop db1
Start-Sleep -Seconds 3

# Test API registration (should work with DB2)
$body = @{username="failover_test_user"; password="test123"} | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost/api/register -Method POST -Body $body -ContentType "application/json"

# Verify user was created in DB2
docker exec db2 mysql -uroot -prootpassword voting -e "SELECT * FROM users WHERE username='failover_test_user';"

# Restart DB1
docker start db1
Start-Sleep -Seconds 20
```
**Expected:** Registration should work, user should appear in DB2

---

## TEST 7: Verify Replication Caught Up
```powershell
# Wait a few seconds
Start-Sleep -Seconds 5

# Check if the user from DB2 appeared in DB1
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT * FROM users WHERE username='failover_test_user';"
```
**Expected:** User should appear in DB1 (replicated from DB2)

---

## TEST 8: Test Bidirectional Replication
```powershell
# Insert into DB1
docker exec db1 mysql -uroot -prootpassword voting -e "INSERT INTO users (username, password) VALUES ('db1_test', 'pass123');"

# Wait 3 seconds
Start-Sleep -Seconds 3

# Check in DB2
docker exec db2 mysql -uroot -prootpassword voting -e "SELECT * FROM users WHERE username='db1_test';"

# Insert into DB2
docker exec db2 mysql -uroot -prootpassword voting -e "INSERT INTO users (username, password) VALUES ('db2_test', 'pass456');"

# Wait 3 seconds
Start-Sleep -Seconds 3

# Check in DB1
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT * FROM users WHERE username='db2_test';"
```
**Expected:** Both inserts should appear in the other database

---

## TEST 9: Final Data Consistency Check
```powershell
# Count users in both databases
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT COUNT(*) as db1_users FROM users;"
docker exec db2 mysql -uroot -prootpassword voting -e "SELECT COUNT(*) as db2_users FROM users;"
```
**Expected:** Both counts should match

---

## TEST 10: Test Complete Flow (Frontend -> Backend -> Database)
```powershell
# Test login endpoint
$loginBody = @{username="ahmed"; password="your_password"} | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost/api/login -Method POST -Body $loginBody -ContentType "application/json"

# Test results endpoint
Invoke-RestMethod -Uri http://localhost/api/results -Method GET
```
**Expected:** Both should work and return data

---

## Summary Checklist

- [ ] All services running
- [ ] Frontend -> Load Balancer -> Backend working
- [ ] Load balancer distributes requests
- [ ] Backend server failover works (backend1 down -> backend2)
- [ ] Master-Master replication active
- [ ] Database failover works (DB1 down -> DB2)
- [ ] Replication catches up after DB1 restarts
- [ ] Bidirectional replication working (DB1 <-> DB2)
- [ ] Data consistent between DB1 and DB2
- [ ] Complete flow working (Frontend -> Backend -> Database)

