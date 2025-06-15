-- orders_schema.sql - Schema for Purchase & Sales Order Management
-- Create orders_db database if it doesn't exist
CREATE DATABASE IF NOT EXISTS orders_db;
USE orders_db;

-- Create customers table for sales orders
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    address TEXT,
    company VARCHAR(255),
    notes TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_email (email),
    INDEX idx_is_active (is_active)
);

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id INT NOT NULL,
    status ENUM('Draft', 'Ordered', 'Shipped', 'Received', 'Cancelled') DEFAULT 'Draft',
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    subtotal DECIMAL(10,2) DEFAULT 0.00,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    shipping_cost DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_po_number (po_number),
    INDEX idx_supplier_id (supplier_id),
    INDEX idx_status (status),
    INDEX idx_order_date (order_date)
);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_order_id INT NOT NULL,
    item_table VARCHAR(100) NOT NULL, -- Which table in master_specs_db (e.g., 'cpu_specs', 'gpu_specs')
    item_id INT NOT NULL, -- ID of the item in the respective table
    item_name VARCHAR(255) NOT NULL, -- Cached name for performance
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    received_quantity INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    INDEX idx_purchase_order_id (purchase_order_id),
    INDEX idx_item_table_id (item_table, item_id)
);

-- Create sales_orders table
CREATE TABLE IF NOT EXISTS sales_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    so_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT,
    status ENUM('Draft', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled') DEFAULT 'Draft',
    order_date DATE NOT NULL,
    ship_date DATE,
    delivery_date DATE,
    subtotal DECIMAL(10,2) DEFAULT 0.00,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    shipping_cost DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    customer_name VARCHAR(255), -- For guest orders
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    shipping_address TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    INDEX idx_so_number (so_number),
    INDEX idx_customer_id (customer_id),
    INDEX idx_status (status),
    INDEX idx_order_date (order_date)
);

-- Create sales_order_items table
CREATE TABLE IF NOT EXISTS sales_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sales_order_id INT NOT NULL,
    item_table VARCHAR(100) NOT NULL, -- Which table in master_specs_db
    item_id INT NOT NULL, -- ID of the item in the respective table
    item_name VARCHAR(255) NOT NULL, -- Cached name for performance
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    shipped_quantity INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    INDEX idx_sales_order_id (sales_order_id),
    INDEX idx_item_table_id (item_table, item_id)
);

-- Insert sample customers
INSERT INTO customers (name, email, phone, address, company, notes) VALUES
('John Doe', 'john.doe@email.com', '+1-555-0101', '123 Main St, Anytown, USA', 'TechCorp', 'Regular customer'),
('Jane Smith', 'jane.smith@email.com', '+1-555-0102', '456 Oak Ave, Somewhere, USA', 'DataSys Inc', 'Corporate client'),
('Mike Johnson', 'mike.johnson@email.com', '+1-555-0103', '789 Pine Rd, Elsewhere, USA', NULL, 'Individual buyer'),
('Sarah Wilson', 'sarah.wilson@email.com', '+1-555-0104', '321 Elm St, Nowhere, USA', 'StartupTech', 'New customer'),
('David Brown', 'david.brown@email.com', '+1-555-0105', '654 Maple Dr, Anyplace, USA', NULL, 'Gaming enthusiast');

-- Insert sample purchase orders
INSERT INTO purchase_orders (po_number, supplier_id, status, order_date, expected_delivery_date, subtotal, tax_amount, total_amount, notes) VALUES
('PO-2025-001', 1, 'Ordered', '2025-06-10', '2025-06-20', 2500.00, 200.00, 2700.00, 'Initial stock order'),
('PO-2025-002', 2, 'Shipped', '2025-06-12', '2025-06-22', 1800.00, 144.00, 1944.00, 'AMD processors'),
('PO-2025-003', 3, 'Received', '2025-06-08', '2025-06-18', 3200.00, 256.00, 3456.00, 'Motherboard restock');

-- Insert sample sales orders
INSERT INTO sales_orders (so_number, customer_id, status, order_date, subtotal, tax_amount, shipping_cost, total_amount, shipping_address, notes) VALUES
('SO-2025-001', 1, 'Confirmed', '2025-06-14', 1500.00, 120.00, 50.00, 1670.00, '123 Main St, Anytown, USA', 'Gaming PC build'),
('SO-2025-002', 2, 'Processing', '2025-06-15', 2800.00, 224.00, 0.00, 3024.00, '456 Oak Ave, Somewhere, USA', 'Office workstation'),
('SO-2025-003', 3, 'Draft', '2025-06-15', 800.00, 64.00, 25.00, 889.00, '789 Pine Rd, Elsewhere, USA', 'Upgrade components');

-- Create triggers to automatically update order totals
DELIMITER $$

CREATE TRIGGER update_po_total_after_insert
AFTER INSERT ON purchase_order_items
FOR EACH ROW
BEGIN
    UPDATE purchase_orders 
    SET subtotal = (
        SELECT COALESCE(SUM(total_price), 0) 
        FROM purchase_order_items 
        WHERE purchase_order_id = NEW.purchase_order_id
    ),
    total_amount = subtotal + tax_amount + shipping_cost
    WHERE id = NEW.purchase_order_id;
END$$

CREATE TRIGGER update_po_total_after_update
AFTER UPDATE ON purchase_order_items
FOR EACH ROW
BEGIN
    UPDATE purchase_orders 
    SET subtotal = (
        SELECT COALESCE(SUM(total_price), 0) 
        FROM purchase_order_items 
        WHERE purchase_order_id = NEW.purchase_order_id
    ),
    total_amount = subtotal + tax_amount + shipping_cost
    WHERE id = NEW.purchase_order_id;
END$$

CREATE TRIGGER update_po_total_after_delete
AFTER DELETE ON purchase_order_items
FOR EACH ROW
BEGIN
    UPDATE purchase_orders 
    SET subtotal = (
        SELECT COALESCE(SUM(total_price), 0) 
        FROM purchase_order_items 
        WHERE purchase_order_id = OLD.purchase_order_id
    ),
    total_amount = subtotal + tax_amount + shipping_cost
    WHERE id = OLD.purchase_order_id;
END$$

CREATE TRIGGER update_so_total_after_insert
AFTER INSERT ON sales_order_items
FOR EACH ROW
BEGIN
    UPDATE sales_orders 
    SET subtotal = (
        SELECT COALESCE(SUM(total_price), 0) 
        FROM sales_order_items 
        WHERE sales_order_id = NEW.sales_order_id
    ),
    total_amount = subtotal + tax_amount + shipping_cost
    WHERE id = NEW.sales_order_id;
END$$

CREATE TRIGGER update_so_total_after_update
AFTER UPDATE ON sales_order_items
FOR EACH ROW
BEGIN
    UPDATE sales_orders 
    SET subtotal = (
        SELECT COALESCE(SUM(total_price), 0) 
        FROM sales_order_items 
        WHERE sales_order_id = NEW.sales_order_id
    ),
    total_amount = subtotal + tax_amount + shipping_cost
    WHERE id = NEW.sales_order_id;
END$$

CREATE TRIGGER update_so_total_after_delete
AFTER DELETE ON sales_order_items
FOR EACH ROW
BEGIN
    UPDATE sales_orders 
    SET subtotal = (
        SELECT COALESCE(SUM(total_price), 0) 
        FROM sales_order_items 
        WHERE sales_order_id = OLD.sales_order_id
    ),
    total_amount = subtotal + tax_amount + shipping_cost
    WHERE id = OLD.sales_order_id;
END$$

DELIMITER ;
