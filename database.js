// database.js - Database connection module
const mariadb = require('mariadb');
require('dotenv').config();

const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectionLimit: 5
});

// Connect and check for errors
async function testConnection() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('Successfully connected to MariaDB database!');
        return true;
    } catch (err) {
        console.error('Error connecting to the database: ', err);
        return false;
    } finally {
        if (conn) conn.release();
    }
}

module.exports = {
    pool,
    testConnection
};
