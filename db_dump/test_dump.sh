#!/bin/bash

# Simple test script
echo "Starting backup test..."

# Load environment variables
source ../.env

echo "Environment loaded: DB_HOST=$DB_HOST, DB_USER=$DB_USER"

# Set timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
echo "Timestamp: $TIMESTAMP"

# Create backup directory
BACKUP_DIR="backup_${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"
echo "Created directory: $BACKUP_DIR"

# Test database connection
echo "Testing database connection..."
if mariadb -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" -e "SELECT 1;" master_specs_db; then
    echo "Database connection successful"
else
    echo "Database connection failed"
    exit 1
fi

# Try to dump one database
echo "Attempting to dump master_specs_db..."
output_file="$BACKUP_DIR/master_specs_db_${TIMESTAMP}.sql"

if mariadb-dump \
    --host="$DB_HOST" \
    --user="$DB_USER" \
    --password="$DB_PASS" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --add-drop-database \
    --databases master_specs_db > "$output_file"; then
    
    echo "Dump successful: $output_file"
    echo "File size: $(ls -lh "$output_file" | awk '{print $5}')"
    
    # Compress the file
    gzip "$output_file"
    echo "Compressed file: ${output_file}.gz"
    echo "Compressed size: $(ls -lh "${output_file}.gz" | awk '{print $5}')"
else
    echo "Dump failed"
    exit 1
fi

echo "Test completed successfully!"
