const { ObjectId } = require('mongodb');

// --- Database Query Functions ---

// Get all products with optional brand/model filters
async function getProducts(db, filters = {}) {
    try {
        const query = {};
        if (filters.brand) query.sm_maker = filters.brand;
        if (filters.model) query.sm_name = filters.model;
        
        return await db.collection('products').find(query).toArray();
    } catch (error) {
        console.error("Error in getProducts:", error);
        throw error;
    }
}

// Get unique brands for filtering
async function getBrands(db) {
    try {
        return await db.collection('products').aggregate([
            { $group: { _id: "$sm_maker", sm_maker: { $first: "$sm_maker" } } },
            { $sort: { sm_maker: 1 } }
        ]).toArray();
    } catch (error) {
        console.error("Error in getBrands:", error);
        throw error;
    }
}

// Get unique models for filtering
async function getModels(db) {
    try {
        return await db.collection('products').aggregate([
            { $group: { _id: "$sm_name", sm_name: { $first: "$sm_name" } } },
            { $sort: { sm_name: 1 } }
        ]).toArray();
    } catch (error) {
        console.error("Error in getModels:", error);
        throw error;
    }
}

// Get a single product by ID
async function getProductById(db, id) {
    try {
        return await db.collection('products').findOne({ _id: new ObjectId(id) });
    } catch (error) {
        console.error("Error in getProductById:", error);
        throw error;
    }
}

// Get all customer information
async function getCustomerInfo(db) {
    try {
        return await db.collection('customers').find({}).toArray();
    } catch (error) {
        console.error("Error in getCustomerInfo:", error);
        throw error;
    }
}

// Get purchase history with customer and product details
async function getPurchaseHistory(db) {
    try {
        return await db.collection('orders').aggregate([
            {
                $lookup: {
                    from: 'customers',
                    localField: 'customer_id',
                    foreignField: '_id',
                    as: 'customerInfo'
                }
            },
            { $unwind: '$customerInfo' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'product_id',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' }
        ]).toArray();
    } catch (error) {
        console.error("Error in getPurchaseHistory:", error);
        throw error;
    }
}

module.exports = {
    getProducts,
    getBrands,
    getModels,
    getProductById,
    getCustomerInfo,
    getPurchaseHistory
};