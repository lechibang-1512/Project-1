-- suppliers_schema.sql - Schema for suppliers database
-- Create suppliers_db database if it doesn't exist
CREATE DATABASE IF NOT EXISTS suppliers_db;
USE suppliers_db;

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    contact_person VARCHAR(255),
    contact_position VARCHAR(255),
    contact_email VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    website VARCHAR(255),
    address TEXT,
    notes TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_name (name),
    INDEX idx_is_active (is_active)
);

-- Insert sample data
INSERT INTO suppliers (
    name,
    category,
    contact_person,
    contact_position,
    contact_email,
    email,
    phone,
    website,
    address,
    notes,
    is_active
) VALUES 
(
    'Intel Corporation',
    'CPU',
    'John Smith',
    'Sales Manager',
    'john.smith@intel.com',
    'sales@intel.com',
    '+1-408-765-8080',
    'https://www.intel.com',
    '2200 Mission College Blvd, Santa Clara, CA 95054, USA',
    'Leading CPU manufacturer',
    1
),
(
    'AMD',
    'CPU',
    'Sarah Johnson',
    'Business Development',
    'sarah.johnson@amd.com',
    'business@amd.com',
    '+1-408-749-4000',
    'https://www.amd.com',
    '2485 Augustine Dr, Santa Clara, CA 95054, USA',
    'CPU and GPU manufacturer',
    1
),
(
    'ASUS',
    'Motherboard',
    'Michael Chen',
    'Regional Sales Director',
    'michael.chen@asus.com',
    'sales@asus.com',
    '+886-2-2894-3447',
    'https://www.asus.com',
    '15 Li-Te Rd., Beitou, Taipei 112, Taiwan',
    'Motherboard and computer hardware manufacturer',
    1
),
(
    'Corsair',
    'Memory',
    'Lisa Wang',
    'Account Manager',
    'lisa.wang@corsair.com',
    'sales@corsair.com',
    '+1-510-657-8747',
    'https://www.corsair.com',
    '47100 Bayside Pkwy, Fremont, CA 94538, USA',
    'Memory, PSU, and cooling solutions',
    1
),
(
    'Samsung',
    'Storage',
    'David Kim',
    'B2B Sales',
    'david.kim@samsung.com',
    'b2b@samsung.com',
    '+82-2-2255-0114',
    'https://www.samsung.com',
    '129 Samsung-ro, Yeongtong-gu, Suwon-si, Gyeonggi-do, South Korea',
    'SSD and memory manufacturer',
    1
),
(
    'Seasonic',
    'PSU',
    'Jennifer Lee',
    'Sales Representative',
    'jennifer.lee@seasonic.com',
    'sales@seasonic.com',
    '+886-2-2659-8360',
    'https://seasonic.com',
    '1F, No.15, Lane 258, Ruiguang Rd., Neihu Dist., Taipei City 114, Taiwan',
    'Premium power supply manufacturer',
    1
),
(
    'Fractal Design',
    'Case',
    'Erik Andersson',
    'Sales Manager',
    'erik.andersson@fractal-design.com',
    'sales@fractal-design.com',
    '+46-31-792-77-00',
    'https://www.fractal-design.com',
    'Kungsportsavenyen 37, 411 36 Göteborg, Sweden',
    'Premium computer case manufacturer',
    1
);
