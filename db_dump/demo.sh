#!/bin/bash

# Quick demonstration of the database manager features
echo "=== Database Manager Demo ==="
echo ""

# Test database connection
echo "1. Testing database connections..."
cd /home/lechibang/Documents/Work/Project-1/db_dump

# Load environment variables
source ../.env

# Test each database
for db in "master_specs_db" "suppliers_db" "orders_db"; do
    if mariadb -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$db" -e "SELECT 1;" >/dev/null 2>&1; then
        echo "✓ Connected to $db"
    else
        echo "✗ Failed to connect to $db"
    fi
done

echo ""
echo "2. Listing available backups..."
./restore_databases.sh --list

echo ""
echo "3. Database statistics..."
for db in "master_specs_db" "suppliers_db" "orders_db"; do
    echo ""
    echo "Database: $db"
    
    # Get table count
    table_count=$(mariadb -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$db" -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$db';" 2>/dev/null | tail -n1)
    
    if [ -n "$table_count" ]; then
        echo "Tables: $table_count"
        
        # Get database size
        db_size=$(mariadb -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$db" -e "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)' FROM information_schema.tables WHERE table_schema = '$db';" 2>/dev/null | tail -n1)
        
        if [ -n "$db_size" ] && [ "$db_size" != "NULL" ]; then
            echo "Size: ${db_size} MB"
        else
            echo "Size: < 1 MB"
        fi
    fi
done

echo ""
echo "4. Current backup directory contents:"
ls -la backup_*/

echo ""
echo "=== Demo completed ==="
echo ""
echo "To use the interactive database manager, run:"
echo "./db_manager.sh"
