// app.js - Main application file
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { pool, suppliersPool, testConnection } = require('./database');

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
    try {
        const conn = await pool.getConnection();
        
        // Get list of tables
        const tables = await conn.query(`
            SELECT TABLE_NAME 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = ?
            ORDER BY TABLE_NAME;
        `, [process.env.DB_NAME]);
        
        conn.release();
        
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
    }
});

// Route for viewing a specific table
app.get('/table/:tableName', async (req, res) => {
    try {
        const tableName = req.params.tableName;
        const conn = await pool.getConnection();
        
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
        
        conn.release();
        
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
    try {
        const conn = await pool.getConnection();
        
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
        
        conn.release();
        
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
    try {
        const conn = await suppliersPool.getConnection();
        
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
        
        conn.release();
        
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
