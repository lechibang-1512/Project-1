#!/bin/bash

# Database Dump Script for Component Database Viewer
# This script creates dumps of all three databases used by the application

# Load environment variables
source ../.env

# Set timestamp for backup files
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Database connection parameters
DB_HOST=${DB_HOST:-localhost}
DB_USER=${DB_USER:-lechibang}
DB_PASS=${DB_PASS:-1212}

# Database names
MASTER_DB="master_specs_db"
SUPPLIERS_DB="suppliers_db"
ORDERS_DB="orders_db"

# Create backup directory with timestamp
BACKUP_DIR="backup_${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

echo "Starting database dump process..."
echo "Timestamp: $TIMESTAMP"
echo "Backup directory: $BACKUP_DIR"
echo "========================================"

# Function to dump a database
dump_database() {
    local db_name=$1
    local output_file="$BACKUP_DIR/${db_name}_${TIMESTAMP}.sql"
    
    echo "Dumping database: $db_name"
    
    if mariadb-dump \
        --host="$DB_HOST" \
        --user="$DB_USER" \
        --password="$DB_PASS" \
        --single-transaction \
        --routines \
        --triggers \
        --events \
        --add-drop-database \
        --create-options \
        --extended-insert \
        --complete-insert \
        --databases "$db_name" > "$output_file"; then
        
        echo "✓ Successfully dumped $db_name to $output_file"
        
        # Compress the dump file
        gzip "$output_file"
        echo "✓ Compressed dump file: ${output_file}.gz"
    else
        echo "✗ Failed to dump database: $db_name"
        return 1
    fi
}

# Dump all databases
echo "Starting individual database dumps..."
dump_database "$MASTER_DB"
dump_database "$SUPPLIERS_DB"
dump_database "$ORDERS_DB"

# Create a combined dump of all databases
echo "Creating combined dump of all databases..."
COMBINED_FILE="$BACKUP_DIR/all_databases_${TIMESTAMP}.sql"

if mariadb-dump \
    --host="$DB_HOST" \
    --user="$DB_USER" \
    --password="$DB_PASS" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --add-drop-database \
    --create-options \
    --extended-insert \
    --complete-insert \
    --databases "$MASTER_DB" "$SUPPLIERS_DB" "$ORDERS_DB" > "$COMBINED_FILE"; then
    
    echo "✓ Successfully created combined dump: $COMBINED_FILE"
    
    # Compress the combined dump
    gzip "$COMBINED_FILE"
    echo "✓ Compressed combined dump: ${COMBINED_FILE}.gz"
else
    echo "✗ Failed to create combined dump"
fi

# Create a metadata file with backup information
METADATA_FILE="$BACKUP_DIR/backup_info.txt"
cat > "$METADATA_FILE" << EOF
Database Backup Information
===========================
Backup Date: $(date)
Timestamp: $TIMESTAMP
Host: $DB_HOST
User: $DB_USER

Databases Backed Up:
- $MASTER_DB
- $SUPPLIERS_DB
- $ORDERS_DB

Files Created:
- ${MASTER_DB}_${TIMESTAMP}.sql.gz
- ${SUPPLIERS_DB}_${TIMESTAMP}.sql.gz
- ${ORDERS_DB}_${TIMESTAMP}.sql.gz
- all_databases_${TIMESTAMP}.sql.gz
- backup_info.txt

Restore Instructions:
====================
To restore individual database:
gunzip database_name_timestamp.sql.gz
mariadb -h $DB_HOST -u $DB_USER -p < database_name_timestamp.sql

To restore all databases:
gunzip all_databases_${TIMESTAMP}.sql.gz
mariadb -h $DB_HOST -u $DB_USER -p < all_databases_${TIMESTAMP}.sql
EOF

echo "✓ Created backup metadata file: $METADATA_FILE"

# Display backup summary
echo ""
echo "========================================"
echo "Backup Summary"
echo "========================================"
echo "Backup location: $(pwd)/$BACKUP_DIR"
echo "Files created:"
ls -lh "$BACKUP_DIR"

echo ""
echo "Total backup size:"
du -sh "$BACKUP_DIR"

echo ""
echo "Database dump process completed successfully!"
echo "Backup directory: $BACKUP_DIR"
