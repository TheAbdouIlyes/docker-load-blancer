# SQL Commands Reference - View Tables and Data

## Quick Commands to View Tables

### View All Tables in Database
```bash
# DB1
docker exec db1 mysql -uroot -prootpassword voting -e "SHOW TABLES;"

# DB2
docker exec db2 mysql -uroot -prootpassword voting -e "SHOW TABLES;"
```

### View Table Structure (Schema)
```bash
# View users table structure
docker exec db1 mysql -uroot -prootpassword voting -e "DESCRIBE users;"
docker exec db1 mysql -uroot -prootpassword voting -e "DESCRIBE votes;"

# Or use SHOW CREATE TABLE for full SQL
docker exec db1 mysql -uroot -prootpassword voting -e "SHOW CREATE TABLE users\G"
```

### View All Data from Tables
```bash
# View all users
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT * FROM users;"

# View all votes
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT * FROM votes;"
```

### View Data with Formatting
```bash
# Pretty format (vertical output)
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT * FROM users\G"

# Count records
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT COUNT(*) as total_users FROM users;"

# View specific columns
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT id, username FROM users;"
```

### Join Tables (Users with their Votes)
```bash
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT u.id, u.username, v.choice, v.created_at FROM users u LEFT JOIN votes v ON u.id = v.user_id ORDER BY u.id;"
```

### Compare Data Between DB1 and DB2 (Verify Replication)
```bash
# Count users in both databases (should match)
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT COUNT(*) as db1_users FROM users;"
docker exec db2 mysql -uroot -prootpassword voting -e "SELECT COUNT(*) as db2_users FROM users;"

# View all data side by side
echo "=== DB1 ===" && docker exec db1 mysql -uroot -prootpassword voting -e "SELECT * FROM users ORDER BY id;" && echo "=== DB2 ===" && docker exec db2 mysql -uroot -prootpassword voting -e "SELECT * FROM users ORDER BY id;"
```

### Filter and Search
```bash
# Find specific user
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT * FROM users WHERE username='ahmed';"

# View recent votes
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT * FROM votes ORDER BY created_at DESC LIMIT 10;"

# View users who voted
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT u.username, v.choice FROM users u INNER JOIN votes v ON u.id = v.user_id;"
```

### Interactive MySQL Shell (Better for exploring)
```bash
# Connect to DB1 interactively
docker exec -it db1 mysql -uroot -prootpassword voting

# Then you can run SQL commands directly:
# SHOW TABLES;
# SELECT * FROM users;
# DESCRIBE votes;
# Exit with: exit or \q
```

## Useful SQL Queries

### Check Replication Status
```bash
docker exec db1 mysql -uroot -prootpassword -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Seconds_Behind_Master)"
```

### View All Databases
```bash
docker exec db1 mysql -uroot -prootpassword -e "SHOW DATABASES;"
```

### View Table Sizes
```bash
docker exec db1 mysql -uroot -prootpassword voting -e "SELECT table_name, table_rows, data_length, index_length FROM information_schema.tables WHERE table_schema='voting';"
```

