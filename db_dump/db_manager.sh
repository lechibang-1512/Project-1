#!/bin/bash

# Database Management Script for Component Database Viewer
# This script provides comprehensive database backup and restore functionality

# Script information
SCRIPT_NAME="Database Manager"
SCRIPT_VERSION="1.0.0"

# Load environment variables if available
if [ -f "../.env" ]; then
    source ../.env
fi

# Database connection parameters
DB_HOST=${DB_HOST:-localhost}
DB_USER=${DB_USER:-lechibang}
DB_PASS=${DB_PASS:-1212}

# Database names
MASTER_DB="master_specs_db"
SUPPLIERS_DB="suppliers_db"
ORDERS_DB="orders_db"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to display main menu
show_main_menu() {
    echo ""
    echo "================================================="
    echo "  $SCRIPT_NAME v$SCRIPT_VERSION"
    echo "================================================="
    echo "1. Create Database Backup"
    echo "2. Restore Database from Backup"
    echo "3. List Available Backups"
    echo "4. Test Database Connection"
    echo "5. Database Statistics"
    echo "6. Cleanup Old Backups"
    echo "7. Help"
    echo "8. Exit"
    echo "================================================="
    echo -n "Select an option (1-8): "
}

# Function to test database connection
test_connection() {
    print_status $BLUE "Testing database connections..."
    
    local success=true
    
    # Test each database connection
    for db in "$MASTER_DB" "$SUPPLIERS_DB" "$ORDERS_DB"; do
        if mariadb -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$db" -e "SELECT 1;" >/dev/null 2>&1; then
            print_status $GREEN "✓ Connected to $db"
        else
            print_status $RED "✗ Failed to connect to $db"
            success=false
        fi
    done
    
    if [ "$success" = true ]; then
        print_status $GREEN "All database connections successful!"
    else
        print_status $RED "Some database connections failed!"
    fi
}

# Function to show database statistics
show_stats() {
    print_status $BLUE "Database Statistics"
    echo "==================="
    
    for db in "$MASTER_DB" "$SUPPLIERS_DB" "$ORDERS_DB"; do
        echo ""
        print_status $YELLOW "Database: $db"
        
        # Get table count
        table_count=$(mariadb -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$db" -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$db';" 2>/dev/null | tail -n1)
        
        if [ -n "$table_count" ]; then
            echo "Tables: $table_count"
            
            # Get database size (in MB)
            db_size=$(mariadb -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$db" -e "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)' FROM information_schema.tables WHERE table_schema = '$db';" 2>/dev/null | tail -n1)
            
            if [ -n "$db_size" ] && [ "$db_size" != "NULL" ]; then
                echo "Size: ${db_size} MB"
            else
                echo "Size: < 1 MB"
            fi
        else
            print_status $RED "Unable to get statistics for $db"
        fi
    done
}

# Function to cleanup old backups
cleanup_backups() {
    echo ""
    print_status $YELLOW "Cleanup Old Backups"
    echo "==================="
    
    # List backup directories
    backup_dirs=$(ls -1d backup_*/ 2>/dev/null | wc -l)
    
    if [ "$backup_dirs" -eq 0 ]; then
        print_status $YELLOW "No backup directories found."
        return
    fi
    
    echo "Found $backup_dirs backup directories:"
    ls -1d backup_*/ 2>/dev/null | while read dir; do
        size=$(du -sh "$dir" | cut -f1)
        date=$(stat -c %y "$dir" | cut -d. -f1)
        echo "  $dir (${size}, created: $date)"
    done
    
    echo ""
    echo "Cleanup options:"
    echo "1. Keep last 5 backups"
    echo "2. Keep backups from last 7 days"
    echo "3. Keep backups from last 30 days"
    echo "4. Manual selection"
    echo "5. Cancel"
    echo -n "Select cleanup option (1-5): "
    
    read cleanup_choice
    
    case $cleanup_choice in
        1)
            print_status $BLUE "Keeping last 5 backups, removing older ones..."
            ls -1td backup_*/ 2>/dev/null | tail -n +6 | xargs rm -rf
            print_status $GREEN "Cleanup completed!"
            ;;
        2)
            print_status $BLUE "Keeping backups from last 7 days..."
            find . -name "backup_*" -type d -mtime +7 -exec rm -rf {} \;
            print_status $GREEN "Cleanup completed!"
            ;;
        3)
            print_status $BLUE "Keeping backups from last 30 days..."
            find . -name "backup_*" -type d -mtime +30 -exec rm -rf {} \;
            print_status $GREEN "Cleanup completed!"
            ;;
        4)
            print_status $YELLOW "Manual selection not implemented yet."
            ;;
        5)
            print_status $YELLOW "Cleanup cancelled."
            ;;
        *)
            print_status $RED "Invalid option."
            ;;
    esac
}

# Function to show help
show_help() {
    echo ""
    echo "Database Manager Help"
    echo "===================="
    echo ""
    echo "This script helps you manage database backups and restores for the"
    echo "Component Database Viewer application."
    echo ""
    echo "Menu Options:"
    echo "  1. Create Database Backup  - Creates timestamped backups of all databases"
    echo "  2. Restore Database        - Restores databases from backup files"
    echo "  3. List Available Backups  - Shows all available backup files"
    echo "  4. Test Database Connection - Tests connection to all databases"
    echo "  5. Database Statistics     - Shows database size and table counts"
    echo "  6. Cleanup Old Backups     - Removes old backup files"
    echo ""
    echo "Files created by this script:"
    echo "  - Individual database dumps (compressed)"
    echo "  - Combined database dump (compressed)"
    echo "  - Backup information file"
    echo ""
    echo "Database Configuration:"
    echo "  Host: $DB_HOST"
    echo "  User: $DB_USER"
    echo "  Databases: $MASTER_DB, $SUPPLIERS_DB, $ORDERS_DB"
    echo ""
}

# Main script execution
main() {
    while true; do
        show_main_menu
        read choice
        
        case $choice in
            1)
                print_status $BLUE "Starting database backup..."
                ./dump_databases.sh
                ;;
            2)
                print_status $BLUE "Starting database restore..."
                ./restore_databases.sh --list
                echo ""
                echo -n "Enter backup file path: "
                read backup_file
                if [ -n "$backup_file" ]; then
                    ./restore_databases.sh "$backup_file"
                fi
                ;;
            3)
                ./restore_databases.sh --list
                ;;
            4)
                test_connection
                ;;
            5)
                show_stats
                ;;
            6)
                cleanup_backups
                ;;
            7)
                show_help
                ;;
            8)
                print_status $GREEN "Goodbye!"
                exit 0
                ;;
            *)
                print_status $RED "Invalid option. Please select 1-8."
                ;;
        esac
        
        echo ""
        echo -n "Press Enter to continue..."
        read
    done
}

# Check if script is being run directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi
