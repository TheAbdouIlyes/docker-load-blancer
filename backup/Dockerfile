FROM alpine:3.19

# Install MariaDB client, bash, and python for simple http server
RUN apk add --no-cache mariadb-client bash python3

# Create backup directory
RUN mkdir -p /backups

# Copy scripts
COPY backup.sh /backup.sh
COPY status-server.py /status-server.py
RUN chmod +x /backup.sh /status-server.py

# Expose status port
EXPOSE 8085

# Run both backup script and status server
CMD ["/bin/bash", "-c", "python3 /status-server.py & /backup.sh"]
