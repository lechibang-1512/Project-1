-- Populate orders_db with realistic orders from phone_specs data
-- This script creates realistic sales orders with phone_specs items

USE orders_db;

-- First, let's clear existing empty orders and create new ones with actual items
DELETE FROM sales_order_items;
DELETE FROM sales_orders;

-- Reset auto-increment
ALTER TABLE sales_orders AUTO_INCREMENT = 1;
ALTER TABLE sales_order_items AUTO_INCREMENT = 1;

-- Create realistic sales orders with phone items
-- Order 1: Corporate bulk order
INSERT INTO sales_orders (
    so_number, customer_id, customer_name, customer_email, customer_phone, 
    shipping_address, order_date, status, tax_amount, shipping_cost, 
    notes, total_amount, created_at, updated_at
) VALUES (
    'SO-2025-001', 2, NULL, NULL, NULL, NULL, 
    '2025-06-10', 'Delivered', 89.75, 25.00, 
    'Corporate bulk order for office phones', 1204.75, 
    '2025-06-10 09:30:00', '2025-06-15 14:30:00'
);

-- Order 2: Individual customer mixed order
INSERT INTO sales_orders (
    so_number, customer_id, customer_name, customer_email, customer_phone, 
    shipping_address, order_date, status, tax_amount, shipping_cost, 
    notes, total_amount, created_at, updated_at
) VALUES (
    'SO-2025-002', 5, NULL, NULL, NULL, NULL, 
    '2025-06-12', 'Shipped', 45.90, 15.00, 
    'Gaming phone upgrade', 575.90, 
    '2025-06-12 15:45:00', '2025-06-14 10:20:00'
);

-- Order 3: Recent large family order
INSERT INTO sales_orders (
    so_number, customer_id, customer_name, customer_email, customer_phone, 
    shipping_address, order_date, status, tax_amount, shipping_cost, 
    notes, total_amount, created_at, updated_at
) VALUES (
    'SO-2025-003', 1, NULL, NULL, NULL, NULL, 
    '2025-06-14', 'Processing', 63.00, 20.00, 
    'Family phone upgrade - 4 phones different colors', 893.00, 
    '2025-06-14 11:20:00', '2025-06-14 11:20:00'
);

-- Order 4: Guest customer order
INSERT INTO sales_orders (
    so_number, customer_id, customer_name, customer_email, customer_phone, 
    shipping_address, order_date, status, tax_amount, shipping_cost, 
    notes, total_amount, created_at, updated_at
) VALUES (
    'SO-2025-004', NULL, 'Alex Rivera', 'alex.rivera@gmail.com', '+1-555-0201', 
    '999 Broadway Ave, Metro City, USA', '2025-06-13', 'Confirmed', 27.00, 12.00, 
    'First-time customer order', 369.00, 
    '2025-06-13 16:30:00', '2025-06-13 18:15:00'
);

-- Order 5: Recent startup company order
INSERT INTO sales_orders (
    so_number, customer_id, customer_name, customer_email, customer_phone, 
    shipping_address, order_date, status, tax_amount, shipping_cost, 
    notes, total_amount, created_at, updated_at
) VALUES (
    'SO-2025-005', 4, NULL, NULL, NULL, NULL, 
    '2025-06-15', 'Draft', 108.00, 30.00, 
    'Startup company phone setup - 8 phones for employees', 1518.00, 
    '2025-06-15 13:45:00', '2025-06-15 13:45:00'
);

-- Add items to Order 1 (Corporate bulk order - 8 phones)
INSERT INTO sales_order_items (
    sales_order_id, item_table, item_id, item_name, quantity, unit_price, total_price, shipped_quantity
) VALUES 
(1, 'phone_specs', 2, 'POCO C-series Black 4GB/128GB', 4, 180.00, 720.00, 4),
(1, 'phone_specs', 4, 'POCO C-series Blue 4GB/128GB', 4, 180.00, 720.00, 4);

-- Add items to Order 2 (Gaming enthusiast - 3 high-end phones)
INSERT INTO sales_order_items (
    sales_order_id, item_table, item_id, item_name, quantity, unit_price, total_price, shipped_quantity
) VALUES 
(2, 'phone_specs', 6, 'POCO C-series Gold 4GB/128GB', 2, 180.00, 360.00, 2),
(2, 'phone_specs', 1, 'POCO C-series Black 3GB/64GB', 1, 150.00, 150.00, 1);

-- Add items to Order 3 (Family order - 4 phones different colors)
INSERT INTO sales_order_items (
    sales_order_id, item_table, item_id, item_name, quantity, unit_price, total_price, shipped_quantity
) VALUES 
(3, 'phone_specs', 1, 'POCO C-series Black 3GB/64GB', 2, 150.00, 300.00, 0),
(3, 'phone_specs', 3, 'POCO C-series Blue 3GB/64GB', 1, 150.00, 150.00, 0),
(3, 'phone_specs', 5, 'POCO C-series Gold 3GB/64GB', 2, 150.00, 300.00, 0),
(3, 'phone_specs', 2, 'POCO C-series Black 4GB/128GB', 1, 180.00, 180.00, 0);

-- Add items to Order 4 (Guest customer - 2 budget phones)
INSERT INTO sales_order_items (
    sales_order_id, item_table, item_id, item_name, quantity, unit_price, total_price, shipped_quantity
) VALUES 
(4, 'phone_specs', 1, 'POCO C-series Black 3GB/64GB', 1, 150.00, 150.00, 1),
(4, 'phone_specs', 4, 'POCO C-series Blue 4GB/128GB', 1, 180.00, 180.00, 1);

-- Add items to Order 5 (Startup company - 8 phones mixed)
INSERT INTO sales_order_items (
    sales_order_id, item_table, item_id, item_name, quantity, unit_price, total_price, shipped_quantity
) VALUES 
(5, 'phone_specs', 2, 'POCO C-series Black 4GB/128GB', 3, 180.00, 540.00, 0),
(5, 'phone_specs', 4, 'POCO C-series Blue 4GB/128GB', 3, 180.00, 540.00, 0),
(5, 'phone_specs', 6, 'POCO C-series Gold 4GB/128GB', 2, 180.00, 360.00, 0);

-- Update totals to be correct (recalculate based on items)
UPDATE sales_orders SET total_amount = (
    SELECT SUM(soi.total_price) + tax_amount + shipping_cost
    FROM sales_order_items soi 
    WHERE soi.sales_order_id = sales_orders.id
) WHERE id IN (1,2,3,4,5);

-- Add some purchase orders for restocking
INSERT INTO purchase_orders (
    po_number, supplier_id, order_date, expected_delivery_date, status, 
    tax_amount, shipping_cost, notes, total_amount, created_at, updated_at
) VALUES 
('PO-2025-001', 1, '2025-06-01', '2025-06-08', 'Received', 150.00, 50.00, 'Monthly phone restock', 2200.00, '2025-06-01 10:00:00', '2025-06-08 14:30:00'),
('PO-2025-002', 1, '2025-06-10', '2025-06-17', 'Shipped', 120.00, 40.00, 'Additional inventory for high demand', 1760.00, '2025-06-10 11:30:00', '2025-06-12 09:15:00'),
('PO-2025-003', 1, '2025-06-14', '2025-06-21', 'Ordered', 90.00, 35.00, 'Emergency restock due to low inventory', 1325.00, '2025-06-14 16:45:00', '2025-06-14 16:45:00');

-- Add purchase order items
INSERT INTO purchase_order_items (
    purchase_order_id, item_table, item_id, item_name, quantity, unit_price, total_price, received_quantity
) VALUES 
-- PO-2025-001 (Received)
(1, 'phone_specs', 1, 'POCO C-series Black 3GB/64GB', 15, 120.00, 1800.00, 15),
(1, 'phone_specs', 2, 'POCO C-series Black 4GB/128GB', 2, 150.00, 300.00, 2),

-- PO-2025-002 (Shipped)
(2, 'phone_specs', 3, 'POCO C-series Blue 3GB/64GB', 10, 120.00, 1200.00, 0),
(2, 'phone_specs', 4, 'POCO C-series Blue 4GB/128GB', 4, 150.00, 600.00, 0),

-- PO-2025-003 (Ordered)
(3, 'phone_specs', 5, 'POCO C-series Gold 3GB/64GB', 8, 120.00, 960.00, 0),
(3, 'phone_specs', 6, 'POCO C-series Gold 4GB/128GB', 2, 150.00, 300.00, 0);

-- Update purchase order totals
UPDATE purchase_orders SET total_amount = (
    SELECT SUM(poi.total_price) + tax_amount + shipping_cost
    FROM purchase_order_items poi 
    WHERE poi.purchase_order_id = purchase_orders.id
) WHERE id IN (1,2,3);

-- Show summary of what we created
SELECT 'Sales Orders Created:' as summary, COUNT(*) as count FROM sales_orders
UNION ALL
SELECT 'Sales Order Items Created:', COUNT(*) FROM sales_order_items
UNION ALL  
SELECT 'Purchase Orders Created:', COUNT(*) FROM purchase_orders
UNION ALL
SELECT 'Purchase Order Items Created:', COUNT(*) FROM purchase_order_items;
