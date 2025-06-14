-- Query to list all tables and their columns in the database
SELECT 
    t.TABLE_NAME AS 'Table Name', 
    GROUP_CONCAT(
        CONCAT(
            c.COLUMN_NAME, ' (', 
            c.COLUMN_TYPE, ', ', 
            CASE WHEN c.IS_NULLABLE = 'YES' THEN 'NULL' ELSE 'NOT NULL' END,
            CASE WHEN c.COLUMN_KEY = 'PRI' THEN ', PRIMARY KEY' 
                 WHEN c.COLUMN_KEY = 'UNI' THEN ', UNIQUE' 
                 WHEN c.COLUMN_KEY = 'MUL' THEN ', INDEX' 
                 ELSE '' 
            END,
            CASE WHEN c.EXTRA != '' THEN CONCAT(', ', c.EXTRA) ELSE '' END,
            ')'
        )
        ORDER BY c.ORDINAL_POSITION 
        SEPARATOR '\n'
    ) AS 'Columns'
FROM 
    information_schema.TABLES t
JOIN 
    information_schema.COLUMNS c ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
WHERE 
    t.TABLE_SCHEMA = 'master_specs_db'
GROUP BY 
    t.TABLE_NAME
ORDER BY 
    t.TABLE_NAME;
