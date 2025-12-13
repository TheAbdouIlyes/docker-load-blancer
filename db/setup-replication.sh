#!/usr/bin/env bash
set -u

# Configuration
DB1_HOST=${DB1_HOST:-db1}
DB2_HOST=${DB2_HOST:-db2}
DB_PORT=${DB_PORT:-3306}
ROOT_PASS=${MYSQL_ROOT_PASSWORD:-rootpassword}
MAX_RETRIES=30
RETRY_INTERVAL=2

# Function to wait for MySQL to be ready
wait_for_mysql() {
    local host=$1
    local retries=0
    
    echo "Waiting for $host to be ready..."
    while [ $retries -lt $MAX_RETRIES ]; do
        if mysql -h"$host" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -e "SELECT 1" >/dev/null 2>&1; then
            echo "$host is ready!"
            return 0
        fi
        retries=$((retries + 1))
        echo "Waiting for $host... ($retries/$MAX_RETRIES)"
        sleep $RETRY_INTERVAL
    done
    
    echo "ERROR: $host failed to become ready after $MAX_RETRIES attempts"
    return 1
}

# Wait for both databases
wait_for_mysql "$DB1_HOST"
wait_for_mysql "$DB2_HOST"

# Additional wait to ensure init scripts have completed
echo "Waiting for initialization to complete..."
sleep 5

# Copy initial data from db1 to db2 (since db2 doesn't have insert statements)
echo "Syncing initial data from db1 to db2..."
mysql -h"$DB2_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -e "SET FOREIGN_KEY_CHECKS=0; TRUNCATE TABLE voting.votes; TRUNCATE TABLE voting.admins; TRUNCATE TABLE voting.candidates; SET FOREIGN_KEY_CHECKS=1;" 2>/dev/null || true

# Copy admins with explicit IDs
echo "Copying admins..."
mysql -h"$DB1_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -sN -e "SELECT id, username, password, IFNULL(email,'') FROM voting.admins" 2>/dev/null | while IFS=$'\t' read -r id user pass email; do
    mysql -h"$DB2_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -e "INSERT INTO voting.admins (id, username, password, email) VALUES ($id, '$user', '$pass', '$email');" 2>/dev/null || true
done

# Copy candidates with explicit IDs
echo "Copying candidates..."
mysql -h"$DB1_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -sN -e "SELECT id, name, description FROM voting.candidates" 2>/dev/null | while IFS=$'\t' read -r id name desc; do
    mysql -h"$DB2_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -e "INSERT INTO voting.candidates (id, name, description) VALUES ($id, '$name', '$desc');" 2>/dev/null || true
done

echo "Data sync complete."

# Stop any existing replication
echo "Stopping existing replication..."
mysql -h"$DB1_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -e "STOP SLAVE; RESET SLAVE ALL;" 2>/dev/null || true
mysql -h"$DB2_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -e "STOP SLAVE; RESET SLAVE ALL;" 2>/dev/null || true

# Get binlog positions
echo "Getting binlog positions..."
DB1_STATUS=$(mysql -h"$DB1_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -e "SHOW MASTER STATUS\G" 2>/dev/null)
DB1_FILE=$(echo "$DB1_STATUS" | grep "File:" | awk '{print $2}')
DB1_POS=$(echo "$DB1_STATUS" | grep "Position:" | awk '{print $2}')

DB2_STATUS=$(mysql -h"$DB2_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -e "SHOW MASTER STATUS\G" 2>/dev/null)
DB2_FILE=$(echo "$DB2_STATUS" | grep "File:" | awk '{print $2}')
DB2_POS=$(echo "$DB2_STATUS" | grep "Position:" | awk '{print $2}')

echo "DB1: $DB1_FILE at position $DB1_POS"
echo "DB2: $DB2_FILE at position $DB2_POS"

# Configure db1 to replicate from db2
echo "Configuring $DB1_HOST to replicate from $DB2_HOST..."
mysql -h"$DB1_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" <<EOF
CHANGE MASTER TO 
  MASTER_HOST='$DB2_HOST',
  MASTER_PORT=$DB_PORT,
  MASTER_USER='repl',
  MASTER_PASSWORD='replpass',
  MASTER_LOG_FILE='$DB2_FILE',
  MASTER_LOG_POS=$DB2_POS;
START SLAVE;
EOF

# Configure db2 to replicate from db1
echo "Configuring $DB2_HOST to replicate from $DB1_HOST..."
mysql -h"$DB2_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" <<EOF
CHANGE MASTER TO 
  MASTER_HOST='$DB1_HOST',
  MASTER_PORT=$DB_PORT,
  MASTER_USER='repl',
  MASTER_PASSWORD='replpass',
  MASTER_LOG_FILE='$DB1_FILE',
  MASTER_LOG_POS=$DB1_POS;
START SLAVE;
EOF

echo ""
echo "Replication setup completed. Checking slave status..."
sleep 2

echo ""
echo "=== $DB1_HOST Slave Status ==="
mysql -h"$DB1_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Last_IO_Error|Last_SQL_Error|Seconds_Behind_Master)" || true

echo ""
echo "=== $DB2_HOST Slave Status ==="
mysql -h"$DB2_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Last_IO_Error|Last_SQL_Error|Seconds_Behind_Master)" || true
