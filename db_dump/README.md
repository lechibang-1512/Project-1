# Database Dump and Restore Scripts

This directory contains scripts for backing up and restoring the databases used by the Component Database Viewer application.

## Files

- `dump_databases.sh` - Creates database backups
- `restore_databases.sh` - Restores databases from backups  
- `db_manager.sh` - Interactive database management tool
- `README.md` - This file

## Databases

The application uses three MariaDB databases:
- `master_specs_db` - Main component specifications
- `suppliers_db` - Supplier information
- `orders_db` - Order management data

## Quick Start

### Create a Backup
```bash
./dump_databases.sh
```

### Interactive Management
```bash
./db_manager.sh
```

### List Available Backups
```bash
./restore_databases.sh --list
```

### Restore from Backup
```bash
./restore_databases.sh backup_20250615_120000/all_databases_20250615_120000.sql.gz
```

## Script Details

### dump_databases.sh
Creates timestamped backups of all databases with:
- Individual database dumps (compressed)
- Combined database dump (compressed)
- Backup metadata file
- Automatic compression using gzip

**Features:**
- Single-transaction dumps for consistency
- Includes routines, triggers, and events
- Complete insert statements for better compatibility
- Timestamped backup directories

### restore_databases.sh
Restores databases from backup files with:
- Support for compressed (.gz) files
- Individual or complete database restore
- Safety confirmations
- Automatic cleanup of temporary files

**Usage:**
```bash
./restore_databases.sh [OPTIONS] BACKUP_FILE

Options:
  -h, --help              Show help message
  -d, --database NAME     Restore to specific database
  -f, --force             Force restore without confirmation
  -l, --list              List available backup files
```

**Examples:**
```bash
# Restore all databases
./restore_databases.sh backup_20250615_120000/all_databases_20250615_120000.sql.gz

# Restore specific database
./restore_databases.sh -d master_specs_db backup_20250615_120000/master_specs_db_20250615_120000.sql.gz

# Force restore without confirmation
./restore_databases.sh -f backup_20250615_120000/all_databases_20250615_120000.sql.gz
```

### db_manager.sh
Interactive menu-driven tool providing:
1. Create Database Backup
2. Restore Database from Backup
3. List Available Backups
4. Test Database Connection
5. Database Statistics
6. Cleanup Old Backups
7. Help
8. Exit

## Backup Directory Structure

Each backup creates a timestamped directory:
```
backup_YYYYMMDD_HHMMSS/
├── master_specs_db_YYYYMMDD_HHMMSS.sql.gz
├── suppliers_db_YYYYMMDD_HHMMSS.sql.gz
├── orders_db_YYYYMMDD_HHMMSS.sql.gz
├── all_databases_YYYYMMDD_HHMMSS.sql.gz
└── backup_info.txt
```

## Configuration

The scripts read database configuration from `../.env`:
```env
DB_HOST=localhost
DB_USER=lechibang
DB_PASS=1212
DB_NAME=master_specs_db
```

## Requirements

- MariaDB/MySQL client tools (`mariadb`, `mariadb-dump`)
- Bash shell
- Access to the databases with backup/restore privileges
- Sufficient disk space for backup files

## Security Notes

- Backup files contain sensitive data - store securely
- Use strong passwords for database access
- Consider encrypting backup files for production use
- Regularly test restore procedures

## Troubleshooting

### "Command not found" errors
Make sure MariaDB client tools are installed:
```bash
# On Arch Linux
sudo pacman -S mariadb-clients

# On Ubuntu/Debian
sudo apt install mariadb-client
```

### Permission errors
Ensure scripts are executable:
```bash
chmod +x *.sh
```

### Database connection errors
1. Check database server is running
2. Verify credentials in `.env` file
3. Test connection manually:
```bash
mariadb -h localhost -u lechibang -p master_specs_db
```

### Disk space issues
- Monitor available disk space before creating backups
- Use the cleanup function in `db_manager.sh` to remove old backups
- Consider storing backups on external storage

## Best Practices

1. **Regular Backups**: Schedule regular backups using cron
2. **Test Restores**: Regularly test restore procedures
3. **Multiple Locations**: Store backups in multiple locations
4. **Monitor Size**: Keep track of backup sizes and cleanup old ones
5. **Document Recovery**: Maintain documentation of recovery procedures

## Automation

To automate daily backups, add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/db_dump && ./dump_databases.sh
```

## Support

For issues or questions, refer to the main application documentation or check the database connection settings in the `.env` file.
