FROM mariadb:10.11

# Install mysql client for replication setup
RUN apt-get update && apt-get install -y mariadb-client && rm -rf /var/lib/apt/lists/*

# Copy replication setup script
COPY setup-replication.sh /usr/local/bin/setup-replication.sh
RUN chmod +x /usr/local/bin/setup-replication.sh

# Keep container running
CMD ["tail", "-f", "/dev/null"]

