#!/bin/bash

# Simple HTTP server to report backup status
# Listens on port 8085

BACKUP_DIR="/backups"

while true; do
    # Wait for a connection on port 8085
    {
        # Read HTTP request
        read request
        
        # Get backup stats
        TOTAL_FILES=$(find "$BACKUP_DIR" -name "*.sql" 2>/dev/null | wc -l)
        TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "0")
        
        # Get latest backups
        LATEST_DB1=$(ls -t "$BACKUP_DIR"/*/db1_*.sql 2>/dev/null | head -1)
        LATEST_DB2=$(ls -t "$BACKUP_DIR"/*/db2_*.sql 2>/dev/null | head -1)
        
        if [ -n "$LATEST_DB1" ]; then
            DB1_TIME=$(stat -c %Y "$LATEST_DB1" 2>/dev/null || echo "0")
            DB1_SIZE=$(du -h "$LATEST_DB1" 2>/dev/null | cut -f1 || echo "0")
            DB1_NAME=$(basename "$LATEST_DB1")
        else
            DB1_TIME="0"
            DB1_SIZE="0"
            DB1_NAME="none"
        fi
        
        if [ -n "$LATEST_DB2" ]; then
            DB2_TIME=$(stat -c %Y "$LATEST_DB2" 2>/dev/null || echo "0")
            DB2_SIZE=$(du -h "$LATEST_DB2" 2>/dev/null | cut -f1 || echo "0")
            DB2_NAME=$(basename "$LATEST_DB2")
        else
            DB2_TIME="0"
            DB2_SIZE="0"
            DB2_NAME="none"
        fi
        
        CURRENT_TIME=$(date +%s)
        
        # Build JSON response
        JSON="{\"totalFiles\":$TOTAL_FILES,\"totalSize\":\"$TOTAL_SIZE\",\"latestDb1\":{\"file\":\"$DB1_NAME\",\"size\":\"$DB1_SIZE\",\"timestamp\":$DB1_TIME},\"latestDb2\":{\"file\":\"$DB2_NAME\",\"size\":\"$DB2_SIZE\",\"timestamp\":$DB2_TIME},\"currentTime\":$CURRENT_TIME}"
        
        # Send HTTP response with CORS headers
        echo -e "HTTP/1.1 200 OK\r"
        echo -e "Content-Type: application/json\r"
        echo -e "Access-Control-Allow-Origin: *\r"
        echo -e "Access-Control-Allow-Methods: GET\r"
        echo -e "Connection: close\r"
        echo -e "\r"
        echo "$JSON"
    } | nc -l -p 8085 -q 1
done
