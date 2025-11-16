-- Add fleet_manager role to users table
ALTER TABLE users 
MODIFY COLUMN role ENUM('shipper', 'trucker', 'fleet_manager', 'admin') NOT NULL;

