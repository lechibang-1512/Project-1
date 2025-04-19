const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const bodyParser = require('body-parser');
const errors = require('./errors');
const dbqueries = require('./dbqueries');
const app = express();

// --- Configuration (hardcoded instead of from .env) ---
const PORT = 3001;
const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'master_specs_db';

// --- Middleware Setup ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- MongoDB Connection ---
let db; // Variable to hold the database instance

async function connectDB() {
    try {
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log(`Successfully connected to MongoDB database: ${DB_NAME}`);

        // Optional: Ensure collections and indexes exist (run once on startup)
        // await dbqueries.setupCollections(db);

    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1); // Exit if database connection fails on startup
    }
}

// --- Middleware to Attach DB to Request ---
// This makes the 'db' object available in your route handlers via req.db
app.use((req, res, next) => {
    if (!db) {
        console.error('Database not available');
        return res.status(500).render('error', { message: errors.DATABASE_CONNECTION_ERROR });
    }
    req.db = db;
    next();
});

// --- Route Handlers ---

// Root route - redirect to homepage
app.get('/', (req, res) => {
    res.redirect('/homepage');
});

// Homepage route
app.get('/homepage', (req, res) => {
    res.render('homepage');
});

// Customer Info Route
app.get('/customerInfo', async (req, res, next) => {
    try {
        const customers = await dbqueries.getCustomerInfo(req.db);
        res.render('customerInfo', { customers });
    } catch (error) {
        console.error('Error fetching customer info:', error);
        next(error);
    }
});

// Products Route
app.get('/products', async (req, res, next) => {
    try {
        const filters = { brand: req.query.brand, model: req.query.model };
        // Pass req.db to the query functions
        const products = await dbqueries.getProducts(req.db, filters);
        const brands = await dbqueries.getBrands(req.db);
        const models = await dbqueries.getModels(req.db);

        res.render('products', {
            products,
            brands,
            models,
            selectedBrand: req.query?.brand || '',
            selectedModel: req.query?.model || ''
        });
    } catch (error) {
        console.error('Error in /products route:', error);
        next(error); // Pass error to the error handler
    }
});

// Single Product Details Route
app.get('/product/:id', async (req, res, next) => {
    try {
        // Validate ID format before querying if needed
        if (!ObjectId.isValid(req.params.id)) {
             return res.status(400).render('error', { message: 'Invalid Product ID format' });
        }
        const product = await dbqueries.getProductById(req.db, req.params.id);

        if (!product) { // findOne returns null if not found
            return res.status(404).render('error', { message: 'Product not found' });
        }

        // MongoDB findOne returns a single document, no need for product[0]
        res.render('productDetails', { product });
    } catch (error) {
        console.error('Error fetching product details:', error);
        next(error);
    }
});

// Purchase History Route
app.get('/purchaseHistory', async (req, res, next) => {
    try {
        // This query will likely need significant changes depending on
        // how you structure 'orders', 'customers', and 'products' in MongoDB.
        // See dbqueries.js for an example using $lookup (aggregation).
        const historyData = await dbqueries.getPurchaseHistory(req.db);

        // --- Analysis Logic (Needs adaptation based on getPurchaseHistory output) ---
        let totalSales = 0;
        let customerSales = {};
        let deviceSales = {};
        let numberOfOrders = 0;

        if (historyData && historyData.length > 0) {
            numberOfOrders = historyData.length;
            historyData.forEach(order => {
                // Access nested data carefully - structure depends on your aggregation pipeline
                const price = parseFloat(order.productDetails?.sm_price); // Example access
                const customerInfo = order.customerInfo; // Example access
                const productDetails = order.productDetails; // Example access

                if (customerInfo && productDetails && !isNaN(price)) {
                    totalSales += price;

                    const customerName = `${customerInfo.first_name} ${customerInfo.last_name}`;
                    customerSales[customerName] = (customerSales[customerName] || 0) + price;

                    deviceSales[productDetails.sm_name] = (deviceSales[productDetails.sm_name] || 0) + price;
                } else {
                    console.warn(`Invalid data encountered in order: ${order._id}`);
                }
            });
        }

        // Helper function might need adjustment if data structure changes
        function getTopItems(salesData, count = 1) {
             const sortedEntries = Object.entries(salesData)
                .sort(([, a], [, b]) => b - a)
                .slice(0, count)
                .map(([name, sales]) => ({ name, sales }));
             return count === 1 ? sortedEntries[0]?.name || 'N/A' : sortedEntries;
         }

        const topCustomer = getTopItems(customerSales);
        const topDevice = getTopItems(deviceSales);
        const avgSalesPerCustomer = Object.keys(customerSales).length > 0 ? totalSales / Object.keys(customerSales).length : 0;
        const topCustomers = getTopItems(customerSales, 5);
        const topDevices = getTopItems(deviceSales, 5);

        res.render('purchaseHistory', {
            orders: historyData, // Pass the aggregated data
            totalSales: totalSales,
            topCustomer: topCustomer === 'N/A' ? "No Data Available" : topCustomer,
            topDevice: topDevice === 'N/A' ? "No Data Available" : topDevice,
            avgSalesPerCustomer: avgSalesPerCustomer,
            numberOfOrders: numberOfOrders,
            topCustomers: topCustomers,
            topDevices: topDevices
        });
        // --- End Analysis Logic ---

    } catch (error) {
        console.error('Error fetching purchase history:', error);
        next(error);
    }
});

// --- Global Error Handler (Example) ---
app.use((err, req, res, next) => {
    console.error("Global Error Handler:", err.message);
    console.error(err.stack);
    // Determine status code from error if possible, otherwise default to 500
    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).render('error', {
        message: err.message || 'An unexpected error occurred.',
        // Optionally pass the error stack in development
        // error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// --- Start Server ---
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}).catch(err => {
    // connectDB already logs the error and exits, but catch here for safety.
    console.error("Failed to start server:", err);
});