#!/bin/bash

# Database Restore Script for Component Database Viewer
# This script restores databases from backup files

# Load environment variables if available
if [ -f "../.env" ]; then
    source ../.env
fi

# Database connection parameters
DB_HOST=${DB_HOST:-localhost}
DB_USER=${DB_USER:-lechibang}
DB_PASS=${DB_PASS:-1212}

# Function to display usage
show_usage() {
    echo "Usage: $0 [OPTIONS] BACKUP_FILE"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  -d, --database NAME     Restore to specific database name"
    echo "  -f, --force             Force restore without confirmation"
    echo "  -l, --list              List available backup files"
    echo ""
    echo "Examples:"
    echo "  $0 backup_20250615_120000/all_databases_20250615_120000.sql.gz"
    echo "  $0 -d master_specs_db backup_20250615_120000/master_specs_db_20250615_120000.sql.gz"
    echo "  $0 --list"
    echo ""
    echo "Available backup directories:"
    ls -1d backup_*/ 2>/dev/null || echo "  No backup directories found"
}

# Function to list available backup files
list_backups() {
    echo "Available backup files:"
    echo "======================"
    
    for backup_dir in backup_*/; do
        if [ -d "$backup_dir" ]; then
            echo ""
            echo "Directory: $backup_dir"
            echo "Created: $(stat -c %y "$backup_dir" | cut -d. -f1)"
            
            if [ -f "${backup_dir}backup_info.txt" ]; then
                echo "Info file available: ${backup_dir}backup_info.txt"
            fi
            
            echo "SQL files:"
            ls -lh "${backup_dir}"*.sql* 2>/dev/null | while read line; do
                echo "  $line"
            done
        fi
    done
}

# Function to restore database
restore_database() {
    local backup_file=$1
    local target_db=$2
    local force_restore=$3
    
    # Check if backup file exists
    if [ ! -f "$backup_file" ]; then
        echo "Error: Backup file '$backup_file' not found!"
        return 1
    fi
    
    # Determine if file is compressed
    local is_compressed=false
    local restore_file="$backup_file"
    
    if [[ "$backup_file" == *.gz ]]; then
        is_compressed=true
        restore_file="${backup_file%.gz}"
        
        echo "Decompressing backup file..."
        if ! gunzip -k "$backup_file"; then
            echo "Error: Failed to decompress backup file!"
            return 1
        fi
    fi
    
    # Confirmation prompt unless forced
    if [ "$force_restore" != "true" ]; then
        echo ""
        echo "WARNING: This will restore the database from backup."
        echo "This operation will overwrite existing data!"
        echo ""
        echo "Backup file: $backup_file"
        if [ -n "$target_db" ]; then
            echo "Target database: $target_db"
        else
            echo "Target: All databases in backup file"
        fi
        echo ""
        read -p "Are you sure you want to continue? (yes/no): " confirm
        
        if [ "$confirm" != "yes" ]; then
            echo "Restore cancelled."
            # Clean up decompressed file if we created it
            if [ "$is_compressed" = true ] && [ -f "$restore_file" ]; then
                rm "$restore_file"
            fi
            return 1
        fi
    fi
    
    echo ""
    echo "Starting database restore..."
    echo "Backup file: $restore_file"
    
    # Perform the restore
    if [ -n "$target_db" ]; then
        echo "Restoring to database: $target_db"
        if mariadb \
            --host="$DB_HOST" \
            --user="$DB_USER" \
            --password="$DB_PASS" \
            "$target_db" < "$restore_file"; then
            echo "✓ Successfully restored to database: $target_db"
        else
            echo "✗ Failed to restore to database: $target_db"
            return 1
        fi
    else
        echo "Restoring all databases from backup..."
        if mariadb \
            --host="$DB_HOST" \
            --user="$DB_USER" \
            --password="$DB_PASS" < "$restore_file"; then
            echo "✓ Successfully restored all databases"
        else
            echo "✗ Failed to restore databases"
            return 1
        fi
    fi
    
    # Clean up decompressed file
    if [ "$is_compressed" = true ] && [ -f "$restore_file" ]; then
        rm "$restore_file"
        echo "✓ Cleaned up temporary decompressed file"
    fi
    
    echo ""
    echo "Database restore completed successfully!"
}

# Parse command line arguments
FORCE_RESTORE=false
TARGET_DB=""
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -l|--list)
            list_backups
            exit 0
            ;;
        -d|--database)
            TARGET_DB="$2"
            shift 2
            ;;
        -f|--force)
            FORCE_RESTORE=true
            shift
            ;;
        -*)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# Check if backup file was provided
if [ -z "$BACKUP_FILE" ]; then
    echo "Error: No backup file specified!"
    echo ""
    show_usage
    exit 1
fi

# Perform the restore
restore_database "$BACKUP_FILE" "$TARGET_DB" "$FORCE_RESTORE"
