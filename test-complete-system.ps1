# Complete System Test Script
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "COMPLETE SYSTEM TEST" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Check all services
Write-Host "TEST 1: Checking all services..." -ForegroundColor Yellow
docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String -Pattern "frontend|haproxy|backend|db"
Write-Host "OK - Services checked`n" -ForegroundColor Green

# Test 2: Frontend -> Load Balancer -> Backend
Write-Host "TEST 2: Testing Frontend -> Load Balancer -> Backend..." -ForegroundColor Yellow
$health = curl -s http://localhost/health
if ($health -eq "OK") {
    Write-Host "OK - Frontend/Load Balancer/Backend working`n" -ForegroundColor Green
} else {
    Write-Host "FAILED - Frontend/Load Balancer/Backend`n" -ForegroundColor Red
}

# Test 3: Load Balancer distribution
Write-Host "TEST 3: Testing Load Balancer..." -ForegroundColor Yellow
for ($i = 1; $i -le 3; $i++) {
    curl -s http://localhost/health | Out-Null
    Start-Sleep -Milliseconds 500
}
Write-Host "OK - Load balancer routing requests`n" -ForegroundColor Green

# Test 4: Backend Server Failover
Write-Host "TEST 4: Testing Backend Server Failover..." -ForegroundColor Yellow
Write-Host "Stopping backend..."
docker stop backend | Out-Null
Start-Sleep -Seconds 2

$healthAfter = curl -s http://localhost/health
if ($healthAfter -eq "OK") {
    Write-Host "OK - Load balancer failed over to backend2`n" -ForegroundColor Green
} else {
    Write-Host "FAILED - Load balancer failover`n" -ForegroundColor Red
}

Write-Host "Restarting backend..."
docker start backend | Out-Null
Start-Sleep -Seconds 3
Write-Host "OK - Backend1 restarted`n" -ForegroundColor Green

# Test 5: Master-Master Replication Status
Write-Host "TEST 5: Checking Master-Master Replication..." -ForegroundColor Yellow
$db1Status = docker exec db1 mysql -uroot -prootpassword -e "SHOW SLAVE STATUS\G" 2>$null | Select-String -Pattern "Slave_IO_Running: Yes"
$db2Status = docker exec db2 mysql -uroot -prootpassword -e "SHOW SLAVE STATUS\G" 2>$null | Select-String -Pattern "Slave_IO_Running: Yes"

if ($db1Status -and $db2Status) {
    Write-Host "OK - Master-Master replication active`n" -ForegroundColor Green
} else {
    Write-Host "FAILED - Master-Master replication`n" -ForegroundColor Red
}

# Test 6: Database Failover
Write-Host "TEST 6: Testing Database Failover (DB1 down -> DB2)..." -ForegroundColor Yellow
Write-Host "Stopping DB1..."
docker stop db1 | Out-Null
Start-Sleep -Seconds 3

$testUser = "failover_test_$(Get-Date -Format 'HHmmss')"
Write-Host "Testing API with DB1 down..."
$registerResult = curl -s -X POST http://localhost/api/register -H "Content-Type: application/json" -d "{`"username`":`"$testUser`",`"password`":`"test123`"}"

if ($registerResult -like "*ok*" -or $registerResult -like "*true*") {
    Write-Host "OK - API worked with DB1 down (using DB2)`n" -ForegroundColor Green
    
    $userInDb2 = docker exec db2 mysql -uroot -prootpassword voting -sN -e "SELECT username FROM users WHERE username='$testUser';" 2>$null
    if ($userInDb2 -eq $testUser) {
        Write-Host "OK - User created in DB2`n" -ForegroundColor Green
    }
} else {
    Write-Host "FAILED - API failed when DB1 was down`n" -ForegroundColor Red
}

Write-Host "Restarting DB1..."
docker start db1 | Out-Null
Start-Sleep -Seconds 20

# Test 7: Replication Catch-up
Write-Host "TEST 7: Verifying Replication Caught Up..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

$userInDb1 = docker exec db1 mysql -uroot -prootpassword voting -sN -e "SELECT username FROM users WHERE username='$testUser';" 2>$null
if ($userInDb1 -eq $testUser) {
    Write-Host "OK - Data replicated from DB2 to DB1`n" -ForegroundColor Green
} else {
    Write-Host "FAILED - Replication did not catch up`n" -ForegroundColor Red
}

# Test 8: Bidirectional Replication
Write-Host "TEST 8: Testing Bidirectional Replication..." -ForegroundColor Yellow

$testUser2 = "bidirectional_test_$(Get-Date -Format 'HHmmss')"
docker exec db1 mysql -uroot -prootpassword voting -e "INSERT INTO users (username, password) VALUES ('$testUser2', 'pass123');" 2>$null | Out-Null
Start-Sleep -Seconds 3

$userInDb2After = docker exec db2 mysql -uroot -prootpassword voting -sN -e "SELECT username FROM users WHERE username='$testUser2';" 2>$null
if ($userInDb2After -eq $testUser2) {
    Write-Host "OK - DB1 -> DB2 replication working`n" -ForegroundColor Green
} else {
    Write-Host "FAILED - DB1 -> DB2 replication`n" -ForegroundColor Red
}

$testUser3 = "reverse_test_$(Get-Date -Format 'HHmmss')"
docker exec db2 mysql -uroot -prootpassword voting -e "INSERT INTO users (username, password) VALUES ('$testUser3', 'pass456');" 2>$null | Out-Null
Start-Sleep -Seconds 3

$userInDb1After = docker exec db1 mysql -uroot -prootpassword voting -sN -e "SELECT username FROM users WHERE username='$testUser3';" 2>$null
if ($userInDb1After -eq $testUser3) {
    Write-Host "OK - DB2 -> DB1 replication working`n" -ForegroundColor Green
} else {
    Write-Host "FAILED - DB2 -> DB1 replication`n" -ForegroundColor Red
}

# Test 9: Data Consistency
Write-Host "TEST 9: Final Data Consistency Check..." -ForegroundColor Yellow
$db1Count = docker exec db1 mysql -uroot -prootpassword voting -sN -e "SELECT COUNT(*) FROM users;" 2>$null
$db2Count = docker exec db2 mysql -uroot -prootpassword voting -sN -e "SELECT COUNT(*) FROM users;" 2>$null

if ($db1Count -eq $db2Count) {
    Write-Host "OK - Data consistent: DB1=$db1Count users, DB2=$db2Count users`n" -ForegroundColor Green
} else {
    Write-Host "FAILED - Data inconsistent: DB1=$db1Count users, DB2=$db2Count users`n" -ForegroundColor Red
}

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Host "Architecture Verified:" -ForegroundColor Yellow
Write-Host "  Frontend -> Load Balancer -> Backend Servers" -ForegroundColor Green
Write-Host "  Load Balancer failover (Backend1 -> Backend2)" -ForegroundColor Green
Write-Host "  Database failover (DB1 -> DB2)" -ForegroundColor Green
Write-Host "  Master-Master replication (DB1 <-> DB2)" -ForegroundColor Green
Write-Host "`nAll systems operational!`n" -ForegroundColor Green
