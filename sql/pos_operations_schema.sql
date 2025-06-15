-- Point of Sale & Operations Database Schema
-- Creates tables for POS transactions, trade-ins, and repair services

USE orders_db;

-- POS Transactions Table
CREATE TABLE IF NOT EXISTS pos_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NULL,
    customer_name VARCHAR(255) NULL,
    customer_email VARCHAR(255) NULL,
    customer_phone VARCHAR(50) NULL,
    cashier_name VARCHAR(100) NOT NULL DEFAULT 'Staff',
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payment_method ENUM('cash', 'card', 'mobile', 'split') NOT NULL DEFAULT 'cash',
    payment_status ENUM('pending', 'completed', 'refunded', 'partial_refund') NOT NULL DEFAULT 'completed',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- POS Transaction Items Table
CREATE TABLE IF NOT EXISTS pos_transaction_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT NOT NULL,
    item_table VARCHAR(100) NOT NULL,
    item_id INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    item_type ENUM('new', 'used', 'refurbished') NOT NULL DEFAULT 'new',
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    total_price DECIMAL(10,2) NOT NULL,
    serial_number VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES pos_transactions(id) ON DELETE CASCADE
);

-- Trade-in Records Table
CREATE TABLE IF NOT EXISTS trade_ins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trade_in_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NULL,
    customer_phone VARCHAR(50) NULL,
    device_brand VARCHAR(100) NOT NULL,
    device_model VARCHAR(255) NOT NULL,
    device_storage VARCHAR(50) NULL,
    device_color VARCHAR(50) NULL,
    device_condition ENUM('excellent', 'good', 'fair', 'poor', 'broken') NOT NULL,
    cosmetic_condition ENUM('excellent', 'good', 'fair', 'poor') NOT NULL,
    functional_status ENUM('fully_working', 'minor_issues', 'major_issues', 'not_working') NOT NULL,
    original_accessories BOOLEAN DEFAULT FALSE,
    original_box BOOLEAN DEFAULT FALSE,
    imei_number VARCHAR(20) NULL,
    serial_number VARCHAR(100) NULL,
    estimated_value DECIMAL(10,2) NOT NULL,
    final_value DECIMAL(10,2) NULL,
    status ENUM('pending_evaluation', 'evaluated', 'accepted', 'rejected', 'completed') NOT NULL DEFAULT 'pending_evaluation',
    evaluation_notes TEXT NULL,
    processed_by VARCHAR(100) NULL,
    transaction_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (transaction_id) REFERENCES pos_transactions(id) ON DELETE SET NULL
);

-- Used/Refurbished Inventory Table
CREATE TABLE IF NOT EXISTS used_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trade_in_id INT NULL,
    item_code VARCHAR(100) UNIQUE NOT NULL,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(255) NOT NULL,
    storage VARCHAR(50) NULL,
    color VARCHAR(50) NULL,
    condition_grade ENUM('A+', 'A', 'B+', 'B', 'C') NOT NULL,
    cosmetic_condition ENUM('excellent', 'good', 'fair', 'poor') NOT NULL,
    functional_status ENUM('fully_working', 'minor_issues', 'tested_working') NOT NULL,
    original_accessories BOOLEAN DEFAULT FALSE,
    original_box BOOLEAN DEFAULT FALSE,
    imei_number VARCHAR(20) UNIQUE NULL,
    serial_number VARCHAR(100) UNIQUE NULL,
    purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    selling_price DECIMAL(10,2) NOT NULL,
    status ENUM('in_stock', 'sold', 'reserved', 'repair_needed') NOT NULL DEFAULT 'in_stock',
    location VARCHAR(100) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    sold_at TIMESTAMP NULL,
    FOREIGN KEY (trade_in_id) REFERENCES trade_ins(id) ON DELETE SET NULL
);

-- Repair Services Table
CREATE TABLE IF NOT EXISTS repair_services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    repair_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NULL,
    customer_phone VARCHAR(50) NOT NULL,
    device_brand VARCHAR(100) NOT NULL,
    device_model VARCHAR(255) NOT NULL,
    device_color VARCHAR(50) NULL,
    imei_number VARCHAR(20) NULL,
    serial_number VARCHAR(100) NULL,
    reported_issues TEXT NOT NULL,
    diagnosis TEXT NULL,
    repair_type ENUM('screen', 'battery', 'charging_port', 'camera', 'speaker', 'microphone', 'water_damage', 'software', 'other') NOT NULL,
    priority ENUM('low', 'normal', 'high', 'urgent') NOT NULL DEFAULT 'normal',
    estimated_cost DECIMAL(10,2) NULL,
    final_cost DECIMAL(10,2) NULL,
    parts_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    labor_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('received', 'diagnosing', 'waiting_approval', 'approved', 'in_progress', 'waiting_parts', 'completed', 'ready_pickup', 'delivered', 'cancelled') NOT NULL DEFAULT 'received',
    technician_assigned VARCHAR(100) NULL,
    estimated_completion DATETIME NULL,
    actual_completion DATETIME NULL,
    warranty_period_days INT NOT NULL DEFAULT 30,
    pickup_password VARCHAR(10) NULL,
    internal_notes TEXT NULL,
    customer_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- Repair Parts Used Table
CREATE TABLE IF NOT EXISTS repair_parts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    repair_id INT NOT NULL,
    part_name VARCHAR(255) NOT NULL,
    part_number VARCHAR(100) NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    supplier VARCHAR(255) NULL,
    warranty_days INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repair_id) REFERENCES repair_services(id) ON DELETE CASCADE
);

-- Repair Status History Table
CREATE TABLE IF NOT EXISTS repair_status_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    repair_id INT NOT NULL,
    status ENUM('received', 'diagnosing', 'waiting_approval', 'approved', 'in_progress', 'waiting_parts', 'completed', 'ready_pickup', 'delivered', 'cancelled') NOT NULL,
    notes TEXT NULL,
    changed_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repair_id) REFERENCES repair_services(id) ON DELETE CASCADE
);

-- Add indexes for better performance
CREATE INDEX idx_pos_transactions_date ON pos_transactions(created_at);
CREATE INDEX idx_pos_transactions_customer ON pos_transactions(customer_id);
CREATE INDEX idx_trade_ins_status ON trade_ins(status);
CREATE INDEX idx_trade_ins_date ON trade_ins(created_at);
CREATE INDEX idx_used_inventory_status ON used_inventory(status);
CREATE INDEX idx_used_inventory_condition ON used_inventory(condition_grade);
CREATE INDEX idx_repairs_status ON repair_services(status);
CREATE INDEX idx_repairs_customer ON repair_services(customer_id);
CREATE INDEX idx_repairs_date ON repair_services(created_at);

-- Insert sample data for demonstration
INSERT INTO pos_transactions (transaction_number, customer_id, cashier_name, subtotal, tax_amount, total_amount, payment_method) VALUES
('POS-2025-001', 1, 'Sarah Williams', 330.00, 26.40, 356.40, 'card'),
('POS-2025-002', NULL, 'Mike Johnson', 180.00, 14.40, 194.40, 'cash'),
('POS-2025-003', 3, 'Sarah Williams', 150.00, 12.00, 162.00, 'mobile');

-- Sample POS transaction items
INSERT INTO pos_transaction_items (transaction_id, item_table, item_id, item_name, quantity, unit_price, total_price) VALUES
(1, 'phone_specs', 2, 'POCO C-series Black 4GB/128GB', 1, 180.00, 180.00),
(1, 'phone_specs', 1, 'POCO C-series Black 3GB/64GB', 1, 150.00, 150.00),
(2, 'phone_specs', 4, 'POCO C-series Blue 4GB/128GB', 1, 180.00, 180.00),
(3, 'phone_specs', 3, 'POCO C-series Blue 3GB/64GB', 1, 150.00, 150.00);

-- Sample trade-in records
INSERT INTO trade_ins (trade_in_number, customer_name, customer_phone, device_brand, device_model, device_condition, cosmetic_condition, functional_status, estimated_value, final_value, status) VALUES
('TI-2025-001', 'John Smith', '+1-555-0201', 'Apple', 'iPhone 12', 'good', 'good', 'fully_working', 300.00, 280.00, 'completed'),
('TI-2025-002', 'Emily Davis', '+1-555-0202', 'Samsung', 'Galaxy S21', 'excellent', 'excellent', 'fully_working', 350.00, 350.00, 'accepted'),
('TI-2025-003', 'Robert Wilson', '+1-555-0203', 'Google', 'Pixel 6', 'fair', 'fair', 'minor_issues', 200.00, NULL, 'pending_evaluation');

-- Sample used inventory from trade-ins
INSERT INTO used_inventory (trade_in_id, item_code, brand, model, condition_grade, cosmetic_condition, functional_status, purchase_price, selling_price, imei_number) VALUES
(1, 'USED-IP12-001', 'Apple', 'iPhone 12 64GB Black', 'A', 'good', 'fully_working', 280.00, 450.00, '123456789012345'),
(2, 'USED-GS21-001', 'Samsung', 'Galaxy S21 128GB Blue', 'A+', 'excellent', 'fully_working', 350.00, 520.00, '123456789012346');

-- Sample repair services
INSERT INTO repair_services (repair_number, customer_name, customer_phone, device_brand, device_model, reported_issues, repair_type, estimated_cost, status, technician_assigned) VALUES
('REP-2025-001', 'Alice Johnson', '+1-555-0301', 'Apple', 'iPhone 13', 'Cracked screen, touch not working properly', 'screen', 120.00, 'in_progress', 'Tech-Alex'),
('REP-2025-002', 'Bob Martinez', '+1-555-0302', 'Samsung', 'Galaxy S22', 'Battery draining very fast, phone gets hot', 'battery', 80.00, 'waiting_approval', 'Tech-Sarah'),
('REP-2025-003', 'Carol Chen', '+1-555-0303', 'POCO', 'C-series', 'Charging port loose, intermittent charging', 'charging_port', 60.00, 'completed', 'Tech-Mike');

-- Sample repair parts
INSERT INTO repair_parts (repair_id, part_name, quantity, unit_cost, total_cost) VALUES
(1, 'iPhone 13 Screen Assembly', 1, 85.00, 85.00),
(2, 'Galaxy S22 Battery', 1, 45.00, 45.00),
(3, 'USB-C Charging Port', 1, 25.00, 25.00);

-- Sample repair status history
INSERT INTO repair_status_history (repair_id, status, notes, changed_by) VALUES
(1, 'received', 'Device received, initial inspection completed', 'Staff'),
(1, 'diagnosing', 'Confirmed screen damage, ordering replacement part', 'Tech-Alex'),
(1, 'in_progress', 'Screen replacement in progress', 'Tech-Alex'),
(2, 'received', 'Device received for battery issues', 'Staff'),
(2, 'diagnosing', 'Battery test confirms degraded capacity', 'Tech-Sarah'),
(2, 'waiting_approval', 'Waiting for customer approval for battery replacement', 'Tech-Sarah'),
(3, 'received', 'Device received for charging issues', 'Staff'),
(3, 'completed', 'Charging port replaced successfully', 'Tech-Mike');

COMMIT;
