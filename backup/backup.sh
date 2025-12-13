#!/bin/bash

# Backup script - runs every 3 minutes
# Backs up both db1 and db2 to /backups folder

BACKUP_DIR="/backups"
MYSQL_USER="root"
MYSQL_PASS="rootpassword"
DATABASE="voting"

# Create dated folder
DATE_FOLDER=$(date +%Y-%m-%d)
mkdir -p "$BACKUP_DIR/$DATE_FOLDER"

echo "==================================="
echo "Backup Service Started"
echo "Interval: 3 minutes"
echo "Backup location: $BACKUP_DIR"
echo "==================================="

while true; do
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    echo ""
    echo "[$(date)] Starting backup cycle..."
    
    # Backup db1
    echo "  Backing up db1..."
    if mysqldump -h db1 -u$MYSQL_USER -p$MYSQL_PASS $DATABASE > "$BACKUP_DIR/$DATE_FOLDER/db1_$TIMESTAMP.sql" 2>/dev/null; then
        SIZE=$(du -h "$BACKUP_DIR/$DATE_FOLDER/db1_$TIMESTAMP.sql" | cut -f1)
        echo "  ✓ db1 backup complete: db1_$TIMESTAMP.sql ($SIZE)"
    else
        echo "  ✗ db1 backup FAILED (db1 might be down)"
        rm -f "$BACKUP_DIR/$DATE_FOLDER/db1_$TIMESTAMP.sql"
    fi
    
    # Backup db2
    echo "  Backing up db2..."
    if mysqldump -h db2 -u$MYSQL_USER -p$MYSQL_PASS $DATABASE > "$BACKUP_DIR/$DATE_FOLDER/db2_$TIMESTAMP.sql" 2>/dev/null; then
        SIZE=$(du -h "$BACKUP_DIR/$DATE_FOLDER/db2_$TIMESTAMP.sql" | cut -f1)
        echo "  ✓ db2 backup complete: db2_$TIMESTAMP.sql ($SIZE)"
    else
        echo "  ✗ db2 backup FAILED (db2 might be down)"
        rm -f "$BACKUP_DIR/$DATE_FOLDER/db2_$TIMESTAMP.sql"
    fi
    
    # Show backup stats
    TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "*.sql" | wc -l)
    TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    echo "  Total backups: $TOTAL_BACKUPS files ($TOTAL_SIZE)"
    
    # Clean up backups older than 7 days
    find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete 2>/dev/null
    find "$BACKUP_DIR" -type d -empty -delete 2>/dev/null
    
    echo "[$(date)] Next backup in 3 minutes..."
    
    # Sleep for 3 minutes (180 seconds)
    sleep 180
done
