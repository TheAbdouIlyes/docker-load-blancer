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

# Additional wait to ensure replication user is created
echo "Waiting for replication user to be available..."
sleep 3

# Get current GTID positions
echo "Getting current GTID positions..."
DB1_GTID=$(mysql -h"$DB1_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -sN -e "SELECT @@gtid_current_pos" 2>/dev/null || echo "")
DB2_GTID=$(mysql -h"$DB2_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -sN -e "SELECT @@gtid_current_pos" 2>/dev/null || echo "")

echo "DB1 current GTID: $DB1_GTID"
echo "DB2 current GTID: $DB2_GTID"

# Stop any existing replication
echo "Stopping existing replication..."
mysql -h"$DB1_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -e "STOP SLAVE; RESET SLAVE ALL;" 2>/dev/null || true
mysql -h"$DB2_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -e "STOP SLAVE; RESET SLAVE ALL;" 2>/dev/null || true

# Set each database's slave position to the OTHER database's current position
# This way, each DB will only replicate NEW transactions from the other
# (since both have the same initial data, we skip the initial transactions)
echo "Setting GTID slave positions..."
echo "Setting $DB1_HOST slave position to $DB2_GTID (to replicate new transactions from $DB2_HOST)..."
mysql -h"$DB1_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" <<EOF || true
SET GLOBAL gtid_slave_pos='$DB2_GTID';
EOF

echo "Setting $DB2_HOST slave position to $DB1_GTID (to replicate new transactions from $DB1_HOST)..."
mysql -h"$DB2_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" <<EOF || true
SET GLOBAL gtid_slave_pos='$DB1_GTID';
EOF

# Configure db1 to replicate from db2 (using MariaDB GTID syntax)
echo "Configuring $DB1_HOST to replicate from $DB2_HOST..."
mysql -h"$DB1_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" <<EOF || true
CHANGE MASTER TO 
  MASTER_HOST='$DB2_HOST',
  MASTER_PORT=$DB_PORT,
  MASTER_USER='repl',
  MASTER_PASSWORD='replpass',
  MASTER_USE_GTID=slave_pos;
START SLAVE;
EOF

# Configure db2 to replicate from db1 (using MariaDB GTID syntax)
echo "Configuring $DB2_HOST to replicate from $DB1_HOST..."
mysql -h"$DB2_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" <<EOF || true
CHANGE MASTER TO 
  MASTER_HOST='$DB1_HOST',
  MASTER_PORT=$DB_PORT,
  MASTER_USER='repl',
  MASTER_PASSWORD='replpass',
  MASTER_USE_GTID=slave_pos;
START SLAVE;
EOF

echo ""
echo "Replication setup completed. Checking slave status..."
echo ""
echo "=== $DB1_HOST Slave Status ==="
mysql -h"$DB1_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Last_IO_Error|Last_SQL_Error|Seconds_Behind_Master)" || true

echo ""
echo "=== $DB2_HOST Slave Status ==="
mysql -h"$DB2_HOST" -P"$DB_PORT" -uroot -p"$ROOT_PASS" -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Last_IO_Error|Last_SQL_Error|Seconds_Behind_Master)" || true
