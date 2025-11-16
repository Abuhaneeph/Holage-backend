USE holage_db;

-- Create default admin user
-- This SQL script creates an admin user with a pre-hashed password
-- Default credentials:
-- Email: admin@holage.com
-- Password: admin123
-- 
-- IMPORTANT: This hash is for 'admin123' password
-- You should change the password after first login!

INSERT INTO users (
    fullName,
    email,
    password,
    role,
    isVerified,
    kycStatus
) VALUES (
    'Admin User',
    'admin@holage.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- bcrypt hash for 'admin123'
    'admin',
    TRUE,
    'approved'
)
ON DUPLICATE KEY UPDATE email = email;

-- Note: To use this script, run it in your MySQL client:
-- mysql -u your_username -p holage_db < create_admin_user.sql
--
-- Or use the Node.js script instead (recommended):
-- npm run create-admin
--
-- Default Login Credentials:
-- Email: admin@holage.com
-- Password: admin123

