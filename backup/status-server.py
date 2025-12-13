#!/usr/bin/env python3
"""Simple HTTP server to report backup status"""

import http.server
import json
import os
import glob
from pathlib import Path

BACKUP_DIR = "/backups"
PORT = 8085

class BackupStatusHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        # Get backup stats
        sql_files = glob.glob(f"{BACKUP_DIR}/**/*.sql", recursive=True)
        total_files = len(sql_files)
        
        # Calculate total size
        total_bytes = sum(os.path.getsize(f) for f in sql_files if os.path.exists(f))
        if total_bytes > 1024 * 1024:
            total_size = f"{total_bytes / (1024*1024):.1f}M"
        elif total_bytes > 1024:
            total_size = f"{total_bytes / 1024:.1f}K"
        else:
            total_size = f"{total_bytes}B"
        
        # Get latest db1 backup
        db1_files = sorted(glob.glob(f"{BACKUP_DIR}/**/db1_*.sql", recursive=True), key=os.path.getmtime, reverse=True)
        db2_files = sorted(glob.glob(f"{BACKUP_DIR}/**/db2_*.sql", recursive=True), key=os.path.getmtime, reverse=True)
        
        latest_db1 = {"file": "none", "size": "0", "timestamp": 0}
        latest_db2 = {"file": "none", "size": "0", "timestamp": 0}
        
        if db1_files:
            f = db1_files[0]
            size = os.path.getsize(f)
            latest_db1 = {
                "file": os.path.basename(f),
                "size": f"{size/1024:.1f}K",
                "timestamp": int(os.path.getmtime(f))
            }
        
        if db2_files:
            f = db2_files[0]
            size = os.path.getsize(f)
            latest_db2 = {
                "file": os.path.basename(f),
                "size": f"{size/1024:.1f}K",
                "timestamp": int(os.path.getmtime(f))
            }
        
        import time
        response = {
            "totalFiles": total_files,
            "totalSize": total_size,
            "latestDb1": latest_db1,
            "latestDb2": latest_db2,
            "currentTime": int(time.time())
        }
        
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())
    
    def log_message(self, format, *args):
        pass  # Suppress logs

if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", PORT), BackupStatusHandler)
    print(f"Backup status server running on port {PORT}")
    server.serve_forever()
