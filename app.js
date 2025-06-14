// app.js - Main application file
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { pool, testConnection } = require('./database');

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
