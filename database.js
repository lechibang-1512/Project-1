// database.js - Database connection module
const mariadb = require('mariadb');
require('dotenv').config();

// Master specs database pool
const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectionLimit: 5
});

// Suppliers database pool
const suppliersPool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: 'suppliers_db',
    connectionLimit: 5
});

// Orders database pool
const ordersPool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: 'orders_db',
    connectionLimit: 5
});

// Connect and check for errors
async function testConnection() {
    let conn;
    let suppliersConn;
    let ordersConn;
    try {
        conn = await pool.getConnection();
        suppliersConn = await suppliersPool.getConnection();
        ordersConn = await ordersPool.getConnection();
        console.log('Successfully connected to MariaDB databases!');
        console.log('- Master Specs DB: Connected');
        console.log('- Suppliers DB: Connected');
        console.log('- Orders DB: Connected');
        return true;
    } catch (err) {
        console.error('Error connecting to the database: ', err);
        return false;
    } finally {
        if (conn) conn.release();
        if (suppliersConn) suppliersConn.release();
        if (ordersConn) ordersConn.release();
    }
}

module.exports = {
    pool,
    suppliersPool,
    ordersPool,
    testConnection
};
