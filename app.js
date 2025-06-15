// app.js - Main application file
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { pool, suppliersPool, ordersPool, testConnection } = require('./database');

// Load environment variables
require('dotenv').config();

const app = express();

// Helper function to format table names for display
function formatTableName(tableName) {
    return tableName
        .replace('_specs', '')
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Set up EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Main route - Overview page
app.get('/', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        
        // Get list of tables
        const tables = await conn.query(`
            SELECT TABLE_NAME 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = ?
            ORDER BY TABLE_NAME;
        `, [process.env.DB_NAME]);
        
        res.render('index', {
            title: 'Component Database Viewer',
            tables: tables
        });
    } catch (err) {
        console.error('Error fetching tables:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// Route for viewing a specific table
app.get('/table/:tableName', async (req, res) => {
    let conn;
    try {
        const tableName = req.params.tableName;
        conn = await pool.getConnection();
        
        // Get table columns
        const columns = await conn.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION;
        `, [process.env.DB_NAME, tableName]);
        
        // Get table data
        const data = await conn.query(`
            SELECT * FROM ${conn.escapeId(tableName)} LIMIT 100;
        `);
        
        // Get record count
        const countResult = await conn.query(`
            SELECT COUNT(*) as count FROM ${conn.escapeId(tableName)};
        `);
        const recordCount = countResult[0].count;
        
        res.render('table', {
            title: `Table: ${formatTableName(tableName)}`,
            tableName: tableName,
            columns: columns,
            data: data,
            recordCount: recordCount,
            searchColumn: 'all',  // Default search column
            searchTerm: ''        // Default search term
        });
    } catch (err) {
        console.error(`Error fetching table ${req.params.tableName}:`, err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// Route for viewing a specific component
app.get('/component/:tableName/:id', async (req, res) => {
    try {
        const tableName = req.params.tableName;
        const id = req.params.id;
        const conn = await pool.getConnection();
        
        // Get table columns
        const columns = await conn.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION;
        `, [process.env.DB_NAME, tableName]);
        
        // Get component data
        const components = await conn.query(`
            SELECT * FROM ${conn.escapeId(tableName)} WHERE id = ?
        `, [id]);
        
        if (components.length === 0) {
            conn.release();
            return res.status(404).render('error', {
                title: 'Not Found',
                error: 'Component not found'
            });
        }
        
        const component = components[0];
        
        // Determine component name based on the table type
        let componentName = '';
        if (component.model) {
            componentName = component.manufacturer ? `${component.manufacturer} ${component.model}` : component.model;
        } else if (component.series) {
            componentName = component.manufacturer ? `${component.manufacturer} ${component.series}` : component.series;
        } else {
            componentName = `Component #${component.id}`;
        }
        
        conn.release();
        
        res.render('component', {
            title: componentName,
            tableName: tableName,
            tableDisplayName: formatTableName(tableName),
            component: component,
            componentName: componentName,
            columns: columns
        });
    } catch (err) {
        console.error(`Error fetching component details:`, err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// Route for searching within a table
app.post('/search/:tableName', async (req, res) => {
    try {
        const tableName = req.params.tableName;
        const searchColumn = req.body.column;
        const searchTerm = req.body.term;
        
        const conn = await pool.getConnection();
        
        // Get table columns
        const columns = await conn.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION;
        `, [process.env.DB_NAME, tableName]);
        
        // Search the table
        let data;
        if (searchColumn === 'all') {
            // Create a dynamic query to search in all columns
            const searchableColumns = columns.filter(col => 
                col.COLUMN_TYPE.includes('char') || 
                col.COLUMN_TYPE.includes('text')
            ).map(col => col.COLUMN_NAME);
            
            if (searchableColumns.length === 0) {
                data = await conn.query(`SELECT * FROM ${conn.escapeId(tableName)} LIMIT 100`);
            } else {
                const whereClauses = searchableColumns.map(col => `${conn.escapeId(col)} LIKE ?`).join(' OR ');
                const params = Array(searchableColumns.length).fill(`%${searchTerm}%`);
                data = await conn.query(`
                    SELECT * FROM ${conn.escapeId(tableName)} 
                    WHERE ${whereClauses}
                    LIMIT 100
                `, params);
            }
        } else {
            // Search in a specific column
            data = await conn.query(`
                SELECT * FROM ${conn.escapeId(tableName)} 
                WHERE ${conn.escapeId(searchColumn)} LIKE ?
                LIMIT 100
            `, [`%${searchTerm}%`]);
        }
        
        const countResult = await conn.query(`
            SELECT COUNT(*) as count FROM ${conn.escapeId(tableName)};
        `);
        const recordCount = countResult[0].count;
        
        conn.release();
        
        res.render('table', {
            title: `Search Results: ${tableName}`,
            tableName: tableName,
            columns: columns,
            data: data,
            recordCount: recordCount,
            searchColumn: searchColumn,
            searchTerm: searchTerm
        });
    } catch (err) {
        console.error(`Error searching table ${req.params.tableName}:`, err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// Inventory Management Routes
app.get('/inventory', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        
        // Get list of tables with stock_quantity column
        const tables = await conn.query(`
            SELECT TABLE_NAME 
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ? AND COLUMN_NAME = 'stock_quantity'
            ORDER BY TABLE_NAME;
        `, [process.env.DB_NAME]);
        
        // Get inventory data from each table
        const inventoryData = [];
        
        for (const table of tables) {
            const tableName = table.TABLE_NAME;
            
            // Get inventory summary for the table
            const data = await conn.query(`
                SELECT 
                    COUNT(*) as total_items, 
                    SUM(stock_quantity) as total_stock,
                    MIN(stock_quantity) as min_stock,
                    MAX(stock_quantity) as max_stock,
                    AVG(stock_quantity) as avg_stock
                FROM ${conn.escapeId(tableName)}
                WHERE stock_quantity IS NOT NULL;
            `);
            
            // Add to inventory data
            inventoryData.push({
                tableName: tableName,
                displayName: formatTableName(tableName),
                summary: data[0]
            });
        }
        
        res.render('inventory', {
            title: 'Inventory Management',
            inventoryData: inventoryData,
            tables: tables,
            formatTableName: formatTableName
        });
    } catch (err) {
        console.error('Error fetching inventory data:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// Route for managing inventory of a specific table
app.get('/inventory/:tableName', async (req, res) => {
    try {
        const tableName = req.params.tableName;
        const conn = await pool.getConnection();
        
        // Check if table exists and has stock_quantity column
        const tableCheck = await conn.query(`
            SELECT COUNT(*) as count
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'stock_quantity';
        `, [process.env.DB_NAME, tableName]);
        
        if (tableCheck[0].count === 0) {
            conn.release();
            return res.status(404).render('error', {
                title: 'Not Found',
                error: 'Table not found or does not have inventory tracking'
            });
        }
        
        // Get columns for identification (manufacturer, model, etc.)
        const columns = await conn.query(`
            SELECT COLUMN_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            AND COLUMN_NAME IN ('id', 'manufacturer', 'model', 'series', 'part_number', 'capacity_gb', 'wattage', 'model_number');
        `, [process.env.DB_NAME, tableName]);
        
        const selectColumns = columns.map(col => col.COLUMN_NAME);
        
        // Get inventory items from the table
        const items = await conn.query(`
            SELECT ${selectColumns.map(col => conn.escapeId(col)).join(', ')}, stock_quantity
            FROM ${conn.escapeId(tableName)}
            ORDER BY stock_quantity ASC;
        `);
        
        conn.release();
        
        res.render('table_inventory', {
            title: `Inventory: ${formatTableName(tableName)}`,
            tableName: tableName,
            tableDisplayName: formatTableName(tableName),
            columns: selectColumns,
            items: items
        });
    } catch (err) {
        console.error(`Error fetching inventory for ${req.params.tableName}:`, err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// Route for updating inventory stock quantity
app.post('/inventory/update', async (req, res) => {
    try {
        const { tableName, id, action, quantity } = req.body;
        
        // Validate input
        if (!tableName || !id || !action || !quantity || isNaN(parseInt(quantity))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input parameters'
            });
        }
        
        const conn = await pool.getConnection();
        
        // Update the stock_quantity based on the action
        let query;
        let queryParams;
        
        switch(action) {
            case 'set':
                query = `UPDATE ${conn.escapeId(tableName)} SET stock_quantity = ? WHERE id = ?`;
                queryParams = [parseInt(quantity), id];
                break;
            case 'add':
                query = `UPDATE ${conn.escapeId(tableName)} SET stock_quantity = COALESCE(stock_quantity, 0) + ? WHERE id = ?`;
                queryParams = [parseInt(quantity), id];
                break;
            case 'subtract':
                query = `UPDATE ${conn.escapeId(tableName)} SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - ?, 0) WHERE id = ?`;
                queryParams = [parseInt(quantity), id];
                break;
            default:
                conn.release();
                return res.status(400).json({
                    success: false,
                    message: 'Invalid action'
                });
        }
        
        // Execute the update query
        await conn.query(query, queryParams);
        
        // Get the updated stock quantity
        const result = await conn.query(`
            SELECT stock_quantity FROM ${conn.escapeId(tableName)} WHERE id = ?
        `, [id]);
        
        conn.release();
        
        res.json({
            success: true,
            newQuantity: result[0].stock_quantity,
            message: 'Inventory updated successfully'
        });
    } catch (err) {
        console.error('Error updating inventory:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// Note: Bulk inventory functionality now integrated as a modal in inventory.ejs

// API endpoint for searching inventory
app.post('/api/inventory/search', async (req, res) => {
    try {
        const { table, type, min, max } = req.body;
        const conn = await pool.getConnection();
        
        let results = [];
        
        // Determine which tables to search
        let tablesToSearch = [];
        if (table === 'all') {
            const tables = await conn.query(`
                SELECT TABLE_NAME 
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = ? AND COLUMN_NAME = 'stock_quantity'
                ORDER BY TABLE_NAME;
            `, [process.env.DB_NAME]);
            tablesToSearch = tables.map(t => t.TABLE_NAME);
        } else {
            tablesToSearch = [table];
        }
        
        // Create the WHERE clause based on the search type
        let whereClause;
        switch (type) {
            case 'low-stock':
                whereClause = 'stock_quantity <= 5 AND stock_quantity > 0';
                break;
            case 'out-of-stock':
                whereClause = 'stock_quantity = 0 OR stock_quantity IS NULL';
                break;
            case 'high-stock':
                whereClause = 'stock_quantity > 20';
                break;
            case 'custom':
                whereClause = `stock_quantity BETWEEN ${conn.escape(parseInt(min))} AND ${conn.escape(parseInt(max))}`;
                break;
            default:
                whereClause = '1=1';
        }
        
        // Search each table
        for (const tableName of tablesToSearch) {
            // Get columns for identification (manufacturer, model, etc.)
            const columns = await conn.query(`
                SELECT COLUMN_NAME
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                AND COLUMN_NAME IN ('id', 'manufacturer', 'model', 'series', 'part_number', 'capacity_gb', 'wattage', 'model_number');
            `, [process.env.DB_NAME, tableName]);
            
            const selectColumns = columns.map(col => col.COLUMN_NAME);
            
            // Get matching items from the table
            const items = await conn.query(`
                SELECT ${selectColumns.map(col => conn.escapeId(col)).join(', ')}, stock_quantity
                FROM ${conn.escapeId(tableName)}
                WHERE ${whereClause}
                ORDER BY stock_quantity ASC;
            `);
            
            // Add table name to each item
            items.forEach(item => {
                item.tableName = tableName;
            });
            
            results = results.concat(items);
        }
        
        conn.release();
        
        res.json({
            success: true,
            results: results
        });
    } catch (err) {
        console.error('Error searching inventory:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// API endpoint for bulk updating inventory
app.post('/api/inventory/bulk-update', async (req, res) => {
    try {
        const { table, action, value, filter } = req.body;
        const conn = await pool.getConnection();
        
        // Determine which tables to update
        let tablesToUpdate = [];
        if (table === 'all') {
            const tables = await conn.query(`
                SELECT TABLE_NAME 
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = ? AND COLUMN_NAME = 'stock_quantity'
                ORDER BY TABLE_NAME;
            `, [process.env.DB_NAME]);
            tablesToUpdate = tables.map(t => t.TABLE_NAME);
        } else {
            tablesToUpdate = [table];
        }
        
        // Create the WHERE clause based on the filter
        let whereClause;
        switch (filter) {
            case 'low':
                whereClause = 'stock_quantity <= 5';
                break;
            case 'zero':
                whereClause = 'stock_quantity = 0 OR stock_quantity IS NULL';
                break;
            default:
                whereClause = '1=1';
        }
        
        // Create the SET clause based on the action
        let setClause;
        switch (action) {
            case 'increase':
                setClause = `stock_quantity = COALESCE(stock_quantity, 0) + ${conn.escape(parseInt(value))}`;
                break;
            case 'decrease':
                setClause = `stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - ${conn.escape(parseInt(value))}, 0)`;
                break;
            case 'set':
                setClause = `stock_quantity = ${conn.escape(parseInt(value))}`;
                break;
            default:
                throw new Error('Invalid action');
        }
        
        // Update each table and count the total updates
        let totalUpdated = 0;
        for (const tableName of tablesToUpdate) {
            const result = await conn.query(`
                UPDATE ${conn.escapeId(tableName)}
                SET ${setClause}
                WHERE ${whereClause}
            `);
            
            totalUpdated += result.affectedRows;
        }
        
        conn.release();
        
        res.json({
            success: true,
            updatedCount: totalUpdated
        });
    } catch (err) {
        console.error('Error performing bulk update:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// API endpoint for updating selected items
app.post('/api/inventory/update-selected', async (req, res) => {
    try {
        const { items, action, quantity } = req.body;
        const conn = await pool.getConnection();
        
        let totalUpdated = 0;
        
        // Group items by table for efficiency
        const itemsByTable = items.reduce((groups, item) => {
            if (!groups[item.table]) {
                groups[item.table] = [];
            }
            groups[item.table].push(item.id);
            return groups;
        }, {});
        
        // Create the SET clause based on the action
        let setClause;
        switch (action) {
            case 'add':
                setClause = `stock_quantity = COALESCE(stock_quantity, 0) + ${conn.escape(parseInt(quantity))}`;
                break;
            case 'subtract':
                setClause = `stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - ${conn.escape(parseInt(quantity))}, 0)`;
                break;
            case 'set':
                setClause = `stock_quantity = ${conn.escape(parseInt(quantity))}`;
                break;
            default:
                throw new Error('Invalid action');
        }
        
        // Update each table and count the total updates
        for (const [tableName, ids] of Object.entries(itemsByTable)) {
            const result = await conn.query(`
                UPDATE ${conn.escapeId(tableName)}
                SET ${setClause}
                WHERE id IN (?)
            `, [ids]);
            
            totalUpdated += result.affectedRows;
        }
        
        conn.release();
        
        res.json({
            success: true,
            updatedCount: totalUpdated
        });
    } catch (err) {
        console.error('Error updating selected items:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// API endpoint for individual item update
app.post('/api/inventory/update', async (req, res) => {
    try {
        const { tableName, id, action, quantity } = req.body;
        const conn = await pool.getConnection();
        
        // Create the SET clause based on the action
        let setClause;
        switch (action) {
            case 'add':
                setClause = `stock_quantity = COALESCE(stock_quantity, 0) + ${conn.escape(parseInt(quantity))}`;
                break;
            case 'subtract':
                setClause = `stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - ${conn.escape(parseInt(quantity))}, 0)`;
                break;
            case 'set':
                setClause = `stock_quantity = ${conn.escape(parseInt(quantity))}`;
                break;
            default:
                throw new Error('Invalid action');
        }
        
        // Update the item
        await conn.query(`
            UPDATE ${conn.escapeId(tableName)}
            SET ${setClause}
            WHERE id = ?
        `, [id]);
        
        // Get the updated quantity
        const result = await conn.query(`
            SELECT stock_quantity
            FROM ${conn.escapeId(tableName)}
            WHERE id = ?
        `, [id]);
        
        conn.release();
        
        res.json({
            success: true,
            newQuantity: result[0].stock_quantity,
            message: 'Inventory updated successfully'
        });
    } catch (err) {
        console.error('Error updating item:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// API endpoint for generating inventory reports
app.post('/api/inventory/report', async (req, res) => {
    try {
        const { table, lowStockThreshold } = req.body;
        const threshold = parseInt(lowStockThreshold) || 5;
        const conn = await pool.getConnection();
        
        // Determine which tables to include in the report
        let tablesToInclude = [];
        if (table === 'all') {
            const tables = await conn.query(`
                SELECT TABLE_NAME 
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = ? AND COLUMN_NAME = 'stock_quantity'
                ORDER BY TABLE_NAME;
            `, [process.env.DB_NAME]);
            tablesToInclude = tables.map(t => t.TABLE_NAME);
        } else {
            tablesToInclude = [table];
        }
        
        // Generate summary data
        const summary = [];
        let allLowStockItems = [];
        
        for (const tableName of tablesToInclude) {
            // Get summary data
            const summaryData = await conn.query(`
                SELECT 
                    COUNT(*) as totalItems,
                    SUM(COALESCE(stock_quantity, 0)) as totalStock,
                    COUNT(CASE WHEN stock_quantity <= ? AND stock_quantity > 0 THEN 1 END) as lowStockItems,
                    COUNT(CASE WHEN stock_quantity = 0 OR stock_quantity IS NULL THEN 1 END) as outOfStockItems,
                    AVG(COALESCE(stock_quantity, 0)) as averageStock
                FROM ${conn.escapeId(tableName)}
            `, [threshold]);
            
            summary.push({
                tableName,
                ...summaryData[0]
            });
            
            // Get low stock items for this table
            const columns = await conn.query(`
                SELECT COLUMN_NAME
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                AND COLUMN_NAME IN ('id', 'manufacturer', 'model', 'series', 'part_number', 'capacity_gb', 'wattage', 'model_number');
            `, [process.env.DB_NAME, tableName]);
            
            const selectColumns = columns.map(col => col.COLUMN_NAME);
            
            const lowStockItems = await conn.query(`
                SELECT ${selectColumns.map(col => conn.escapeId(col)).join(', ')}, stock_quantity
                FROM ${conn.escapeId(tableName)}
                WHERE stock_quantity <= ? AND stock_quantity > 0
                ORDER BY stock_quantity ASC;
            `, [threshold]);
            
            // Add table name to each item
            lowStockItems.forEach(item => {
                item.tableName = tableName;
            });
            
            allLowStockItems = allLowStockItems.concat(lowStockItems);
        }
        
        conn.release();
        
        res.json({
            success: true,
            report: {
                summary,
                lowStockItems: allLowStockItems,
                lowStockThreshold: threshold
            }
        });
    } catch (err) {
        console.error('Error generating report:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// ===== SUPPLIER MANAGEMENT ROUTES =====

// Suppliers overview page
app.get('/suppliers', async (req, res) => {
    let conn;
    try {
        conn = await suppliersPool.getConnection();
        
        // Get suppliers with filtering and search
        const { category, status, search } = req.query;
        
        let query = 'SELECT * FROM suppliers WHERE 1=1';
        let params = [];
        
        if (category && category !== 'all') {
            query += ' AND category = ?';
            params.push(category);
        }
        
        if (status === 'active') {
            query += ' AND is_active = 1';
        } else if (status === 'inactive') {
            query += ' AND is_active = 0';
        }
        
        if (search) {
            query += ' AND (name LIKE ? OR contact_person LIKE ? OR email LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }
        
        query += ' ORDER BY name ASC';
        
        const suppliers = await conn.query(query, params);
        
        // Get categories for filter
        const categories = await conn.query(`
            SELECT DISTINCT category 
            FROM suppliers 
            WHERE category IS NOT NULL AND category != '' 
            ORDER BY category
        `);
        
        // Get statistics
        const stats = await conn.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive,
                COUNT(DISTINCT category) as categories
            FROM suppliers
        `);
        
        res.render('suppliers/index', {
            title: 'Supplier Management',
            suppliers: suppliers,
            categories: categories,
            stats: stats[0],
            currentFilters: { category, status, search }
        });
    } catch (err) {
        console.error('Error fetching suppliers:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// Add new supplier form
app.get('/suppliers/add', (req, res) => {
    res.render('suppliers/add', {
        title: 'Add New Supplier'
    });
});

// Create new supplier
app.post('/suppliers/add', async (req, res) => {
    try {
        const {
            name, category, contact_person, contact_position,
            contact_email, email, phone, website, address, notes
        } = req.body;
        
        const conn = await suppliersPool.getConnection();
        
        await conn.query(`
            INSERT INTO suppliers (
                name, category, contact_person, contact_position,
                contact_email, email, phone, website, address, notes, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [name, category, contact_person, contact_position, contact_email, email, phone, website, address, notes]);
        
        conn.release();
        
        res.redirect('/suppliers?success=Supplier added successfully');
    } catch (err) {
        console.error('Error adding supplier:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// View supplier details
app.get('/suppliers/:id', async (req, res) => {
    try {
        const supplierId = req.params.id;
        const conn = await suppliersPool.getConnection();
        
        const suppliers = await conn.query('SELECT * FROM suppliers WHERE id = ?', [supplierId]);
        
        if (suppliers.length === 0) {
            conn.release();
            return res.status(404).render('error', {
                title: 'Supplier Not Found',
                error: 'The requested supplier could not be found.'
            });
        }
        
        const supplier = suppliers[0];
        
        conn.release();
        
        res.render('suppliers/view', {
            title: `Supplier: ${supplier.name}`,
            supplier: supplier
        });
    } catch (err) {
        console.error('Error fetching supplier:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// Edit supplier form
app.get('/suppliers/:id/edit', async (req, res) => {
    try {
        const supplierId = req.params.id;
        const conn = await suppliersPool.getConnection();
        
        const suppliers = await conn.query('SELECT * FROM suppliers WHERE id = ?', [supplierId]);
        
        if (suppliers.length === 0) {
            conn.release();
            return res.status(404).render('error', {
                title: 'Supplier Not Found',
                error: 'The requested supplier could not be found.'
            });
        }
        
        const supplier = suppliers[0];
        
        conn.release();
        
        res.render('suppliers/edit', {
            title: `Edit Supplier: ${supplier.name}`,
            supplier: supplier
        });
    } catch (err) {
        console.error('Error fetching supplier for edit:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// Update supplier
app.post('/suppliers/:id/edit', async (req, res) => {
    try {
        const supplierId = req.params.id;
        const {
            name, category, contact_person, contact_position,
            contact_email, email, phone, website, address, notes, is_active
        } = req.body;
        
        const conn = await suppliersPool.getConnection();
        
        await conn.query(`
            UPDATE suppliers SET 
                name = ?, category = ?, contact_person = ?, contact_position = ?,
                contact_email = ?, email = ?, phone = ?, website = ?, 
                address = ?, notes = ?, is_active = ?
            WHERE id = ?
        `, [name, category, contact_person, contact_position, contact_email, 
            email, phone, website, address, notes, is_active ? 1 : 0, supplierId]);
        
        conn.release();
        
        res.redirect(`/suppliers/${supplierId}?success=Supplier updated successfully`);
    } catch (err) {
        console.error('Error updating supplier:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// Toggle supplier status (activate/deactivate)
app.post('/suppliers/:id/toggle-status', async (req, res) => {
    try {
        const supplierId = req.params.id;
        const conn = await suppliersPool.getConnection();
        
        await conn.query(`
            UPDATE suppliers SET is_active = NOT is_active WHERE id = ?
        `, [supplierId]);
        
        conn.release();
        
        res.redirect('/suppliers?success=Supplier status updated');
    } catch (err) {
        console.error('Error toggling supplier status:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// Delete supplier
app.post('/suppliers/:id/delete', async (req, res) => {
    try {
        const supplierId = req.params.id;
        const conn = await suppliersPool.getConnection();
        
        await conn.query('DELETE FROM suppliers WHERE id = ?', [supplierId]);
        
        conn.release();
        
        res.redirect('/suppliers?success=Supplier deleted successfully');
    } catch (err) {
        console.error('Error deleting supplier:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// API endpoint for supplier search autocomplete
app.get('/api/suppliers/search', async (req, res) => {
    try {
        const { q } = req.query;
        const conn = await suppliersPool.getConnection();
        
        const suppliers = await conn.query(`
            SELECT id, name, category, email 
            FROM suppliers 
            WHERE is_active = 1 AND (name LIKE ? OR category LIKE ?)
            ORDER BY name ASC
            LIMIT 10
        `, [`%${q}%`, `%${q}%`]);
        
        conn.release();
        
        res.json(suppliers);
    } catch (err) {
        console.error('Error searching suppliers:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===== END SUPPLIER MANAGEMENT ROUTES =====

// ===== ORDER MANAGEMENT ROUTES =====

// Helper function to generate unique order numbers
function generateOrderNumber(type) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    return `${type}-${year}${month}${day}-${time}`;
}

// Helper function to get component tables
async function getComponentTables() {
    const conn = await pool.getConnection();
    const tables = await conn.query(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE '%_specs'
        ORDER BY TABLE_NAME;
    `, [process.env.DB_NAME]);
    conn.release();
    return tables;
}

// Helper function to get component by table and ID
async function getComponentById(tableName, id) {
    const conn = await pool.getConnection();
    const components = await conn.query(`
        SELECT * FROM ${conn.escapeId(tableName)} WHERE id = ?
    `, [id]);
    conn.release();
    if (components.length > 0) {
        const component = components[0];
        // Add a consistent 'name' field for different table types
        if (tableName === 'phone_specs') {
            component.name = `${component.sm_name} ${component.color} ${component.ram}/${component.rom}`;
        } else if (component.model) {
            component.name = component.model;
        } else if (component.brand) {
            component.name = component.brand;
        }
        return component;
    }
    return null;
}

// Helper function to update inventory stock
async function updateInventoryStock(tableName, itemId, quantityChange, operation) {
    const conn = await pool.getConnection();
    try {
        if (operation === 'increase') {
            await conn.query(`
                UPDATE ${conn.escapeId(tableName)} 
                SET stock_quantity = COALESCE(stock_quantity, 0) + ? 
                WHERE id = ?
            `, [quantityChange, itemId]);
        } else if (operation === 'decrease') {
            await conn.query(`
                UPDATE ${conn.escapeId(tableName)} 
                SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - ?) 
                WHERE id = ?
            `, [quantityChange, itemId]);
        }
    } finally {
        conn.release();
    }
}

// Orders Overview Dashboard
app.get('/orders', async (req, res) => {
    let conn;
    try {
        conn = await ordersPool.getConnection();
        
        // Get order statistics
        const poStats = await conn.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('Draft', 'Ordered') THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'Received' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
                COALESCE(SUM(total_amount), 0) as total_value
            FROM purchase_orders
        `);
        
        const soStats = await conn.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('Draft', 'Confirmed', 'Processing') THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
                COALESCE(SUM(total_amount), 0) as total_value
            FROM sales_orders
        `);
        
        // Get recent orders
        const recentPOs = await conn.query(`
            SELECT po.*, s.name as supplier_name
            FROM purchase_orders po
            LEFT JOIN suppliers_db.suppliers s ON po.supplier_id = s.id
            ORDER BY po.created_at DESC
            LIMIT 5
        `);
        
        const recentSOs = await conn.query(`
            SELECT so.*, c.name as registered_customer_name
            FROM sales_orders so
            LEFT JOIN customers c ON so.customer_id = c.id
            ORDER BY so.created_at DESC
            LIMIT 5
        `);
        
        res.render('orders/dashboard', {
            title: 'Order Management Dashboard',
            poStats: poStats[0],
            soStats: soStats[0],
            recentPOs: recentPOs,
            recentSOs: recentSOs
        });
    } catch (err) {
        console.error('Error fetching orders dashboard:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// ===== PURCHASE ORDERS =====

// Purchase Orders List
app.get('/orders/purchase', async (req, res) => {
    let conn;
    try {
        conn = await ordersPool.getConnection();
        const { status, supplier } = req.query;
        
        let query = `
            SELECT po.*, s.name as supplier_name
            FROM purchase_orders po
            LEFT JOIN suppliers_db.suppliers s ON po.supplier_id = s.id
            WHERE 1=1
        `;
        let params = [];
        
        if (status && status !== 'all') {
            query += ' AND po.status = ?';
            params.push(status);
        }
        
        if (supplier && supplier !== 'all') {
            query += ' AND po.supplier_id = ?';
            params.push(supplier);
        }
        
        query += ' ORDER BY po.created_at DESC';
        
        const purchaseOrders = await conn.query(query, params);
        
        // Get suppliers for filter
        const suppliers = await conn.query(`
            SELECT id, name FROM suppliers_db.suppliers WHERE is_active = 1 ORDER BY name
        `);
        
        res.render('orders/purchase/index', {
            title: 'Purchase Orders',
            purchaseOrders: purchaseOrders,
            suppliers: suppliers,
            currentFilters: { status, supplier }
        });
    } catch (err) {
        console.error('Error fetching purchase orders:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// Create Purchase Order Form
app.get('/orders/purchase/create', async (req, res) => {
    let conn, suppliersConn;
    try {
        conn = await ordersPool.getConnection();
        suppliersConn = await suppliersPool.getConnection();
        
        // Get active suppliers
        const suppliers = await suppliersConn.query(`
            SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name
        `);
        
        // Get component tables
        const componentTables = await getComponentTables();
        
        res.render('orders/purchase/create', {
            title: 'Create Purchase Order',
            suppliers: suppliers,
            componentTables: componentTables,
            formatTableName: formatTableName
        });
    } catch (err) {
        console.error('Error loading purchase order form:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    } finally {
        if (conn) conn.release();
        if (suppliersConn) suppliersConn.release();
    }
});

// Create Purchase Order
app.post('/orders/purchase/create', async (req, res) => {
    let conn;
    try {
        const { supplier_id, order_date, expected_delivery_date, tax_amount, shipping_cost, notes, items } = req.body;
        conn = await ordersPool.getConnection();
        
        await conn.beginTransaction();
        
        // Generate PO number
        const poNumber = generateOrderNumber('PO');
        
        // Create purchase order
        const result = await conn.query(`
            INSERT INTO purchase_orders (po_number, supplier_id, order_date, expected_delivery_date, tax_amount, shipping_cost, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [poNumber, supplier_id, order_date, expected_delivery_date || null, tax_amount || 0, shipping_cost || 0, notes || '']);
        
        const purchaseOrderId = result.insertId;
        
        // Add items
        if (items && items.length > 0) {
            for (const item of items) {
                const component = await getComponentById(item.item_table, item.item_id);
                if (component) {
                    const totalPrice = parseFloat(item.quantity) * parseFloat(item.unit_price);
                    await conn.query(`
                        INSERT INTO purchase_order_items (purchase_order_id, item_table, item_id, item_name, quantity, unit_price, total_price)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [purchaseOrderId, item.item_table, item.item_id, component.model || component.name || 'Unknown', item.quantity, item.unit_price, totalPrice]);
                }
            }
        }
        
        await conn.commit();
        
        res.redirect(`/orders/purchase/${purchaseOrderId}?success=Purchase order created successfully`);
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rollbackErr) {
                console.error('Error rolling back transaction:', rollbackErr);
            }
        }
        console.error('Error creating purchase order:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// View Purchase Order
app.get('/orders/purchase/:id', async (req, res) => {
    try {
        const poId = req.params.id;
        const conn = await ordersPool.getConnection();
        
        // Get purchase order with supplier info
        const purchaseOrders = await conn.query(`
            SELECT po.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone
            FROM purchase_orders po
            LEFT JOIN suppliers_db.suppliers s ON po.supplier_id = s.id
            WHERE po.id = ?
        `, [poId]);
        
        if (purchaseOrders.length === 0) {
            conn.release();
            return res.status(404).render('error', {
                title: 'Purchase Order Not Found',
                error: 'The requested purchase order could not be found.'
            });
        }
        
        // Get purchase order items
        const items = await conn.query(`
            SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id
        `, [poId]);
        
        conn.release();
        
        res.render('orders/purchase/view', {
            title: `Purchase Order: ${purchaseOrders[0].po_number}`,
            purchaseOrder: purchaseOrders[0],
            items: items
        });
    } catch (err) {
        console.error('Error fetching purchase order:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// Update Purchase Order Status
app.post('/orders/purchase/:id/status', async (req, res) => {
    try {
        const poId = req.params.id;
        const { status, actual_delivery_date } = req.body;
        const conn = await ordersPool.getConnection();
        
        await conn.beginTransaction();
        
        // Update purchase order status
        await conn.query(`
            UPDATE purchase_orders 
            SET status = ?, actual_delivery_date = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, actual_delivery_date || null, poId]);
        
        // If status is 'Received', update inventory
        if (status === 'Received') {
            const items = await conn.query(`
                SELECT * FROM purchase_order_items WHERE purchase_order_id = ?
            `, [poId]);
            
            for (const item of items) {
                await updateInventoryStock(item.item_table, item.item_id, item.quantity, 'increase');
                
                // Update received quantity
                await conn.query(`
                    UPDATE purchase_order_items 
                    SET received_quantity = quantity 
                    WHERE id = ?
                `, [item.id]);
            }
        }
        
        await conn.commit();
        conn.release();
        
        res.redirect(`/orders/purchase/${poId}?success=Purchase order status updated successfully`);
    } catch (err) {
        console.error('Error updating purchase order status:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// ===== SALES ORDERS =====

// Sales Orders List
app.get('/orders/sales', async (req, res) => {
    let conn;
    try {
        conn = await ordersPool.getConnection();
        const { status, customer } = req.query;
        
        let query = `
            SELECT so.*, c.name as registered_customer_name
            FROM sales_orders so
            LEFT JOIN customers c ON so.customer_id = c.id
            WHERE 1=1
        `;
        let params = [];
        
        if (status && status !== 'all') {
            query += ' AND so.status = ?';
            params.push(status);
        }
        
        if (customer && customer !== 'all') {
            query += ' AND so.customer_id = ?';
            params.push(customer);
        }
        
        query += ' ORDER BY so.created_at DESC';
        
        const salesOrders = await conn.query(query, params);
        
        // Get customers for filter
        const customers = await conn.query(`
            SELECT id, name FROM customers WHERE is_active = 1 ORDER BY name
        `);
        
        res.render('orders/sales/index', {
            title: 'Sales Orders',
            salesOrders: salesOrders,
            customers: customers,
            currentFilters: { status, customer }
        });
    } catch (err) {
        console.error('Error fetching sales orders:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// Create Sales Order Form
app.get('/orders/sales/create', async (req, res) => {
    let conn;
    try {
        conn = await ordersPool.getConnection();
        
        // Get active customers
        const customers = await conn.query(`
            SELECT * FROM customers WHERE is_active = 1 ORDER BY name
        `);
        
        // Get component tables
        const componentTables = await getComponentTables();
        
        res.render('orders/sales/create', {
            title: 'Create Sales Order',
            customers: customers,
            componentTables: componentTables,
            formatTableName: formatTableName
        });
    } catch (err) {
        console.error('Error loading sales order form:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// Create Sales Order
app.post('/orders/sales/create', async (req, res) => {
    try {
        const { customer_id, customer_name, customer_email, customer_phone, shipping_address, order_date, tax_amount, shipping_cost, notes, items } = req.body;
        const conn = await ordersPool.getConnection();
        
        await conn.beginTransaction();
        
        // Generate SO number
        const soNumber = generateOrderNumber('SO');
        
        // Create sales order
        const result = await conn.query(`
            INSERT INTO sales_orders (so_number, customer_id, customer_name, customer_email, customer_phone, shipping_address, order_date, tax_amount, shipping_cost, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [soNumber, customer_id || null, customer_name || '', customer_email || '', customer_phone || '', shipping_address || '', order_date, tax_amount || 0, shipping_cost || 0, notes || '']);
        
        const salesOrderId = result.insertId;
        
        // Add items
        if (items && items.length > 0) {
            for (const item of items) {
                const component = await getComponentById(item.item_table, item.item_id);
                if (component) {
                    const totalPrice = parseFloat(item.quantity) * parseFloat(item.unit_price);
                    await conn.query(`
                        INSERT INTO sales_order_items (sales_order_id, item_table, item_id, item_name, quantity, unit_price, total_price)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [salesOrderId, item.item_table, item.item_id, component.model || component.name || 'Unknown', item.quantity, item.unit_price, totalPrice]);
                }
            }
        }
        
        await conn.commit();
        conn.release();
        
        res.redirect(`/orders/sales/${salesOrderId}?success=Sales order created successfully`);
    } catch (err) {
        console.error('Error creating sales order:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// View Sales Order
app.get('/orders/sales/:id', async (req, res) => {
    try {
        const soId = req.params.id;
        const conn = await ordersPool.getConnection();
        
        // Get sales order with customer info
        const salesOrders = await conn.query(`
            SELECT so.*, c.name as registered_customer_name, c.email as registered_customer_email, c.phone as registered_customer_phone, c.address as registered_customer_address
            FROM sales_orders so
            LEFT JOIN customers c ON so.customer_id = c.id
            WHERE so.id = ?
        `, [soId]);
        
        if (salesOrders.length === 0) {
            conn.release();
            return res.status(404).render('error', {
                title: 'Sales Order Not Found',
                error: 'The requested sales order could not be found.'
            });
        }
        
        // Get sales order items
        const items = await conn.query(`
            SELECT * FROM sales_order_items WHERE sales_order_id = ? ORDER BY id
        `, [soId]);
        
        conn.release();
        
        res.render('orders/sales/view', {
            title: `Sales Order: ${salesOrders[0].so_number}`,
            salesOrder: salesOrders[0],
            items: items
        });
    } catch (err) {
        console.error('Error fetching sales order:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// Update Sales Order Status
app.post('/orders/sales/:id/status', async (req, res) => {
    try {
        const soId = req.params.id;
        const { status, ship_date, delivery_date } = req.body;
        const conn = await ordersPool.getConnection();
        
        await conn.beginTransaction();
        
        // Update sales order status
        await conn.query(`
            UPDATE sales_orders 
            SET status = ?, ship_date = ?, delivery_date = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, ship_date || null, delivery_date || null, soId]);
        
        // If status is 'Delivered', update inventory
        if (status === 'Delivered') {
            const items = await conn.query(`
                SELECT * FROM sales_order_items WHERE sales_order_id = ?
            `, [soId]);
            
            for (const item of items) {
                await updateInventoryStock(item.item_table, item.item_id, item.quantity, 'decrease');
                
                // Update shipped quantity
                await conn.query(`
                    UPDATE sales_order_items 
                    SET shipped_quantity = quantity 
                    WHERE id = ?
                `, [item.id]);
            }
        }
        
        await conn.commit();
        conn.release();
        
        res.redirect(`/orders/sales/${soId}?success=Sales order status updated successfully`);
    } catch (err) {
        console.error('Error updating sales order status:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// ===== CUSTOMERS MANAGEMENT =====

// Customers List
app.get('/orders/customers', async (req, res) => {
    let conn;
    try {
        conn = await ordersPool.getConnection();
        
        const customers = await conn.query(`
            SELECT c.*, 
                COUNT(so.id) as total_orders,
                COALESCE(SUM(so.total_amount), 0) as total_spent
            FROM customers c
            LEFT JOIN sales_orders so ON c.id = so.customer_id
            GROUP BY c.id
            ORDER BY c.name
        `);
        
        res.render('orders/customers/index', {
            title: 'Customer Management',
            customers: customers
        });
    } catch (err) {
        console.error('Error fetching customers:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// Add Customer Form
app.get('/orders/customers/add', (req, res) => {
    res.render('orders/customers/add', {
        title: 'Add New Customer'
    });
});

// Create Customer
app.post('/orders/customers/add', async (req, res) => {
    let conn;
    try {
        const { name, email, phone, address, company, notes } = req.body;
        conn = await ordersPool.getConnection();
        
        await conn.query(`
            INSERT INTO customers (name, email, phone, address, company, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [name, email || null, phone || '', address || '', company || '', notes || '']);
        
        res.redirect('/orders/customers?success=Customer added successfully');
    } catch (err) {
        console.error('Error adding customer:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// View Customer Details
app.get('/orders/customers/:id', async (req, res) => {
    let conn;
    try {
        const customerId = req.params.id;
        conn = await ordersPool.getConnection();
        
        // Get customer details
        const customers = await conn.query('SELECT * FROM customers WHERE id = ?', [customerId]);
        
        if (customers.length === 0) {
            return res.status(404).render('error', {
                title: 'Customer Not Found',
                error: 'The requested customer could not be found.'
            });
        }
        
        const customer = customers[0];
        
        // Get customer orders
        const orders = await conn.query(`
            SELECT * FROM sales_orders 
            WHERE customer_id = ? 
            ORDER BY created_at DESC
        `, [customerId]);
        
        // Get customer statistics
        const stats = await conn.query(`
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_amount), 0) as total_spent,
                COUNT(CASE WHEN status IN ('Draft', 'Confirmed', 'Processing') THEN 1 END) as pending_orders,
                COALESCE(AVG(total_amount), 0) as avg_order_value
            FROM sales_orders 
            WHERE customer_id = ?
        `, [customerId]);
        
        res.render('orders/customers/view', {
            title: `Customer: ${customer.name}`,
            customer: customer,
            orders: orders,
            stats: stats[0]
        });
    } catch (err) {
        console.error('Error fetching customer:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// Edit Customer Form
app.get('/orders/customers/:id/edit', async (req, res) => {
    let conn;
    try {
        const customerId = req.params.id;
        conn = await ordersPool.getConnection();
        
        const customers = await conn.query('SELECT * FROM customers WHERE id = ?', [customerId]);
        
        if (customers.length === 0) {
            return res.status(404).render('error', {
                title: 'Customer Not Found',
                error: 'The requested customer could not be found.'
            });
        }
        
        const customer = customers[0];
        
        res.render('orders/customers/edit', {
            title: `Edit Customer: ${customer.name}`,
            customer: customer
        });
    } catch (err) {
        console.error('Error fetching customer for edit:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// Update Customer
app.post('/orders/customers/:id/edit', async (req, res) => {
    try {
        const customerId = req.params.id;
        const { name, email, phone, address, company, notes, is_active } = req.body;
        const conn = await ordersPool.getConnection();
        
        await conn.query(`
            UPDATE customers SET 
                name = ?, email = ?, phone = ?, address = ?, 
                company = ?, notes = ?, is_active = ?
            WHERE id = ?
        `, [name, email || null, phone || '', address || '', 
            company || '', notes || '', is_active ? 1 : 0, customerId]);
        
        conn.release();
        
        res.redirect(`/orders/customers/${customerId}?success=Customer updated successfully`);
    } catch (err) {
        console.error('Error updating customer:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// Toggle Customer Status
app.post('/orders/customers/:id/toggle-status', async (req, res) => {
    try {
        const customerId = req.params.id;
        const conn = await ordersPool.getConnection();
        
        await conn.query(`
            UPDATE customers SET is_active = NOT is_active WHERE id = ?
        `, [customerId]);
        
        conn.release();
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error toggling customer status:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API endpoints for dynamic component loading
app.get('/api/components/:tableName', async (req, res) => {
    try {
        const tableName = req.params.tableName;
        const conn = await pool.getConnection();
        
        let query = '';
        if (tableName === 'phone_specs') {
            // Special handling for phone_specs table
            query = `
                SELECT id, 
                    CONCAT(sm_name, ' ', color, ' ', ram, '/', rom) as name,
                    COALESCE(sm_price, 0) as price,
                    COALESCE(sm_inventory, 0) as stock
                FROM ${conn.escapeId(tableName)}
                ORDER BY sm_name, ram, rom
                LIMIT 50
            `;
        } else {
            // Default handling for other component tables
            query = `
                SELECT id, 
                    COALESCE(model, name, brand) as name,
                    COALESCE(price, 0) as price,
                    COALESCE(stock_quantity, 0) as stock
                FROM ${conn.escapeId(tableName)}
                ORDER BY name
                LIMIT 50
            `;
        }
        
        const components = await conn.query(query);
        
        conn.release();
        
        res.json(components);
    } catch (err) {
        console.error('Error fetching components:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===== END ORDER MANAGEMENT ROUTES =====

// ===== POS & OPERATIONS SYSTEM ROUTES =====

// POS Main Interface
app.get('/pos', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        
        // Get sample customers for the dropdown
        const customers = await ordersPool.getConnection().then(async (ordersConn) => {
            const customersList = await ordersConn.query(`
                SELECT id, name, email, phone 
                FROM customers 
                WHERE is_active = 1 
                ORDER BY name 
                LIMIT 50
            `);
            ordersConn.release();
            return customersList;
        });
        
        res.render('pos/index', {
            title: 'Point of Sale',
            customers: customers,
            cashier: 'Staff'
        });
    } catch (err) {
        console.error('Error loading POS interface:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// POS Trade-ins Management
app.get('/pos/trade-ins', async (req, res) => {
    let conn;
    try {
        conn = await ordersPool.getConnection();
        
        // Get trade-in records with pagination
        const { status, condition, brand } = req.query;
        
        let query = `
            SELECT t.*, c.name as registered_customer_name, c.phone as registered_customer_phone 
            FROM trade_ins t
            LEFT JOIN orders_db.customers c ON t.customer_id = c.id
            WHERE 1=1
        `;
        let params = [];
        
        if (status && status !== 'all') {
            query += ' AND t.status = ?';
            params.push(status);
        }
        
        if (condition && condition !== 'all') {
            query += ' AND t.device_condition = ?';
            params.push(condition);
        }
        
        if (brand && brand !== 'all') {
            query += ' AND t.device_brand = ?';
            params.push(brand);
        }
        
        query += ' ORDER BY t.created_at DESC LIMIT 50';
        
        const tradeIns = await conn.query(query, params);
        
        // Get statistics
        const stats = await conn.query(`
            SELECT 
                COUNT(*) as total_trade_ins,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_evaluations,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN offered_amount ELSE 0 END), 0) as total_trade_value
            FROM trade_ins
        `);
        
        conn.release();
        
        res.render('pos/trade-ins', {
            title: 'Trade-in Management',
            tradeIns: tradeIns,
            stats: stats[0],
            currentFilters: { status, condition, brand }
        });
    } catch (err) {
        console.error('Error loading trade-ins:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// POS Repair Services
app.get('/pos/repairs', async (req, res) => {
    let conn;
    try {
        conn = await ordersPool.getConnection();
        
        // Get repair services with filtering
        const { status, priority, technician } = req.query;
        
        let query = `
            SELECT r.*, c.name as registered_customer_name, c.phone as registered_customer_phone,
                   GROUP_CONCAT(DISTINCT p.part_name) as parts_used
            FROM repair_services r
            LEFT JOIN orders_db.customers c ON r.customer_id = c.id
            LEFT JOIN repair_parts p ON r.id = p.repair_id
            WHERE 1=1
        `;
        let params = [];
        
        if (status && status !== 'all') {
            query += ' AND r.status = ?';
            params.push(status);
        }
        
        if (priority && priority !== 'all') {
            query += ' AND r.priority = ?';
            params.push(priority);
        }
        
        if (technician && technician !== 'all') {
            query += ' AND r.assigned_technician = ?';
            params.push(technician);
        }
        
        query += ' GROUP BY r.id ORDER BY r.created_at DESC LIMIT 50';
        
        const repairs = await conn.query(query, params);
        
        // Get statistics
        const stats = await conn.query(`
            SELECT 
                COUNT(*) as total_repairs,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN total_cost ELSE 0 END), 0) as total_revenue
            FROM repair_services
        `);
        
        conn.release();
        
        res.render('pos/repairs', {
            title: 'Repair Services',
            repairs: repairs,
            stats: stats[0],
            currentFilters: { status, priority, technician }
        });
    } catch (err) {
        console.error('Error loading repairs:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// ===== POS API ENDPOINTS =====

// Used Inventory Management
app.get('/pos/used-inventory', async (req, res) => {
    let conn;
    try {
        conn = await ordersPool.getConnection();
        
        // Get used inventory with filtering
        const { brand, condition, stock, search } = req.query;
        
        let query = `
            SELECT * FROM used_inventory WHERE 1=1
        `;
        let params = [];
        
        if (brand && brand !== 'all') {
            query += ' AND brand = ?';
            params.push(brand);
        }
        
        if (condition && condition !== 'all') {
            query += ' AND cosmetic_condition = ?';
            params.push(condition);
        }
        
        if (stock === 'in_stock') {
            query += ' AND status = "in_stock"';
        } else if (stock === 'sold') {
            query += ' AND status = "sold"';
        }
        
        if (search) {
            query += ' AND (brand LIKE ? OR model LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const inventory = await conn.query(query, params);
        
        // Get statistics
        const stats = await conn.query(`
            SELECT 
                COUNT(*) as total_devices,
                COUNT(CASE WHEN status = 'in_stock' THEN 1 END) as in_stock,
                COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold,
                COALESCE(SUM(CASE WHEN status = 'in_stock' THEN selling_price ELSE 0 END), 0) as total_value
            FROM used_inventory
        `);
        
        conn.release();
        
        res.render('pos/used-inventory', {
            title: 'Used Inventory Management',
            inventory: inventory,
            stats: stats[0],
            currentFilters: { brand, condition, stock, search }
        });
    } catch (err) {
        console.error('Error loading used inventory:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// Create Trade-in Form
app.get('/pos/trade-ins/create', async (req, res) => {
    let conn;
    try {
        // Get customers for dropdown
        conn = await ordersPool.getConnection();
        const customers = await conn.query(`
            SELECT id, name, email, phone 
            FROM customers 
            WHERE is_active = 1 
            ORDER BY name 
            LIMIT 100
        `);
        conn.release();
        
        res.render('pos/trade-ins/create', {
            title: 'Create Trade-in',
            customers: customers
        });
    } catch (err) {
        console.error('Error loading trade-in form:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// Create Repair Form
app.get('/pos/repairs/create', async (req, res) => {
    let conn;
    try {
        // Get customers for dropdown
        conn = await ordersPool.getConnection();
        const customers = await conn.query(`
            SELECT id, name, email, phone 
            FROM customers 
            WHERE is_active = 1 
            ORDER BY name 
            LIMIT 100
        `);
        conn.release();
        
        res.render('pos/repairs/create', {
            title: 'Create Repair Service',
            customers: customers
        });
    } catch (err) {
        console.error('Error loading repair form:', err);
        res.status(500).render('error', {
            title: 'Error',
            error: err.message
        });
    }
});

// Create Trade-in API
app.post('/api/pos/trade-ins/create', async (req, res) => {
    let conn;
    try {
        const {
            customer_id, customer_name, customer_phone, customer_email,
            device_brand, device_model, device_condition, device_storage,
            original_price, offered_amount, notes, has_charger, has_box
        } = req.body;
        
        conn = await ordersPool.getConnection();
        
        const result = await conn.query(`
            INSERT INTO trade_ins (
                customer_id, customer_name, customer_phone, customer_email,
                device_brand, device_model, device_condition, device_storage,
                estimated_value, notes, original_accessories, original_box, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_evaluation')
        `, [customer_id || null, customer_name, customer_phone, customer_email || '',
            device_brand, device_model, device_condition, device_storage || '',
            offered_amount || 0, notes || '',
            has_charger ? 1 : 0, has_box ? 1 : 0]);
        
        conn.release();
        
        res.json({
            success: true,
            trade_in_id: result.insertId,
            message: 'Trade-in created successfully'
        });
        
    } catch (err) {
        console.error('Error creating trade-in:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// Create Repair API
app.post('/api/pos/repairs/create', async (req, res) => {
    let conn;
    try {
        const {
            customer_id, customer_name, customer_phone, customer_email,
            device_brand, device_model, device_imei, issue_description,
            repair_type, priority, estimated_cost, assigned_technician,
            warranty_status, estimated_completion, notes, backup_data, customer_notified
        } = req.body;
        
        conn = await ordersPool.getConnection();
        await conn.beginTransaction();
        
        // Generate repair number
        const repairNumber = generateOrderNumber('REP');
        
        const result = await conn.query(`
            INSERT INTO repair_services (
                repair_number, customer_id, customer_name, customer_phone, customer_email,
                device_brand, device_model, imei_number, reported_issues, repair_type,
                priority, estimated_cost, technician_assigned, estimated_completion, 
                customer_notes, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received')
        `, [repairNumber, customer_id || null, customer_name, customer_phone, customer_email || '',
            device_brand, device_model, device_imei || '', issue_description, repair_type,
            priority, estimated_cost || 0, assigned_technician || '', 
            estimated_completion || null, notes || '']);
        
        const repairId = result.insertId;
        
        // Add initial status history
        await conn.query(`
            INSERT INTO repair_status_history (repair_id, status, notes, changed_by)
            VALUES (?, 'received', 'Repair service created', ?)
        `, [repairId, assigned_technician || 'System']);
        
        await conn.commit();
        conn.release();
        
        res.json({
            success: true,
            repair_id: repairId,
            repair_number: repairNumber,
            message: 'Repair service created successfully'
        });
        
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rollbackErr) {
                console.error('Error rolling back transaction:', rollbackErr);
            }
        }
        console.error('Error creating repair service:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// Update Used Inventory Device
app.post('/api/pos/used-inventory/:id/update', async (req, res) => {
    let conn;
    try {
        const deviceId = req.params.id;
        const { selling_price, stock_quantity, device_condition, notes } = req.body;
        
        conn = await ordersPool.getConnection();
        
        await conn.query(`
            UPDATE used_inventory 
            SET selling_price = ?, cosmetic_condition = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [selling_price, device_condition, notes || '', deviceId]);
        
        conn.release();
        
        res.json({
            success: true,
            message: 'Device updated successfully'
        });
        
    } catch (err) {
        console.error('Error updating used inventory device:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// Mark Used Inventory Device as Sold
app.post('/api/pos/used-inventory/:id/sell', async (req, res) => {
    let conn;
    try {
        const deviceId = req.params.id;
        const { quantity, sold_price, notes } = req.body;
        
        conn = await ordersPool.getConnection();
        
        // Update status to sold
        await conn.query(`
            UPDATE used_inventory 
            SET status = 'sold', 
                notes = ?, 
                sold_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [notes || '', deviceId]);
        
        conn.release();
        
        res.json({
            success: true,
            message: 'Device marked as sold successfully'
        });
        
    } catch (err) {
        console.error('Error marking device as sold:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// Process POS Transaction
app.post('/api/pos/process-transaction', async (req, res) => {
    let conn;
    try {
        const { 
            customer_id, 
            customer_name, 
            customer_email, 
            customer_phone,
            payment_method, 
            items, 
            subtotal, 
            tax_amount, 
            discount_amount, 
            total_amount,
            notes 
        } = req.body;
        
        conn = await ordersPool.getConnection();
        await conn.beginTransaction();
        
        // Generate transaction number
        const transactionNumber = generateOrderNumber('POS');
        
        // Insert POS transaction
        const transactionResult = await conn.query(`
            INSERT INTO pos_transactions (
                transaction_number, customer_id, customer_name, customer_email, customer_phone,
                payment_method, subtotal, tax_amount, discount_amount, total_amount, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [transactionNumber, customer_id || null, customer_name || '', customer_email || '', 
            customer_phone || '', payment_method, subtotal, tax_amount || 0, discount_amount || 0, 
            total_amount, notes || '']);
        
        const transactionId = transactionResult.insertId;
        
        // Insert transaction items and update inventory
        for (const item of items) {
            // Insert transaction item
            await conn.query(`
                INSERT INTO pos_transaction_items (
                    pos_transaction_id, item_table, item_id, item_name, 
                    quantity, unit_price, total_price
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [transactionId, item.category, item.id, item.name, 
                item.quantity, item.price, item.quantity * item.price]);
            
            // Update inventory - decrease stock
            if (item.category === 'phone_specs') {
                await conn.query(`
                    UPDATE phone_specs 
                    SET sm_inventory = GREATEST(0, COALESCE(sm_inventory, 0) - ?) 
                    WHERE id = ?
                `, [item.quantity, item.id]);
            } else if (item.category === 'used_inventory') {
                await conn.query(`
                    UPDATE used_inventory 
                    SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - ?) 
                    WHERE id = ?
                `, [item.quantity, item.id]);
            }
        }
        
        await conn.commit();
        
        res.json({
            success: true,
            transaction_id: transactionId,
            transaction_number: transactionNumber,
            message: 'Transaction processed successfully'
        });
        
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rollbackErr) {
                console.error('Error rolling back transaction:', rollbackErr);
            }
        }
        console.error('Error processing POS transaction:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// Get Used Inventory for POS
app.get('/api/pos/used-inventory', async (req, res) => {
    let conn;
    try {
        conn = await ordersPool.getConnection();
        
        const usedPhones = await conn.query(`
            SELECT id, 
                   CONCAT(brand, ' ', model, ' (', cosmetic_condition, ')') as name,
                   selling_price as price,
                   CASE WHEN status = 'in_stock' THEN 1 ELSE 0 END as stock
            FROM used_inventory 
            WHERE status = 'in_stock' 
            ORDER BY brand, model
            LIMIT 100
        `);
        
        conn.release();
        res.json(usedPhones);
        
    } catch (err) {
        console.error('Error fetching used inventory:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// Update Trade-in Status
app.post('/api/pos/trade-ins/:id/status', async (req, res) => {
    let conn;
    try {
        const tradeInId = req.params.id;
        const { status, offered_amount, notes } = req.body;
        
        conn = await ordersPool.getConnection();
        await conn.beginTransaction();
        
        // Update trade-in status
        await conn.query(`
            UPDATE trade_ins 
            SET status = ?, final_value = ?, evaluation_notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, offered_amount || 0, notes || '', tradeInId]);
        
        // If accepted, create used inventory entry
        if (status === 'accepted') {
            const tradeIn = await conn.query(`
                SELECT * FROM trade_ins WHERE id = ?
            `, [tradeInId]);
            
            if (tradeIn.length > 0) {
                const trade = tradeIn[0];
                await conn.query(`
                    INSERT INTO used_inventory (
                        trade_in_id, brand, model, cosmetic_condition, 
                        purchase_price, selling_price, status, item_code
                    ) VALUES (?, ?, ?, ?, ?, ?, 'in_stock', ?)
                `, [trade.id, trade.device_brand, trade.device_model, trade.device_condition,
                    trade.final_value, trade.final_value * 1.3, // 30% markup
                    `TI-${trade.id}-${Date.now()}`
                ]);
            }
        }
        
        await conn.commit();
        
        res.json({
            success: true,
            message: 'Trade-in status updated successfully'
        });
        
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rollbackErr) {
                console.error('Error rolling back transaction:', rollbackErr);
            }
        }
        console.error('Error updating trade-in status:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// Update Repair Status
app.post('/api/pos/repairs/:id/status', async (req, res) => {
    let conn;
    try {
        const repairId = req.params.id;
        const { status, assigned_technician, estimated_completion, notes } = req.body;
        
        conn = await ordersPool.getConnection();
        await conn.beginTransaction();
        
        // Update repair service
        await conn.query(`
            UPDATE repair_services 
            SET status = ?, technician_assigned = ?, estimated_completion = ?, internal_notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, assigned_technician || '', estimated_completion || null, notes || '', repairId]);
        
        // Add status history entry
        await conn.query(`
            INSERT INTO repair_status_history (repair_id, status, notes, changed_by)
            VALUES (?, ?, ?, ?)
        `, [repairId, status, notes || '', assigned_technician || 'System']);
        
        await conn.commit();
        
        res.json({
            success: true,
            message: 'Repair status updated successfully'
        });
        
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rollbackErr) {
                console.error('Error rolling back transaction:', rollbackErr);
            }
        }
        console.error('Error updating repair status:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// ===== END POS SYSTEM ROUTES =====

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    // Test database connection
    const connected = await testConnection();
    if (connected) {
        console.log(`Server running on http://localhost:${PORT}`);
    } else {
        console.error('Warning: Server started but database connection failed');
    }
});
