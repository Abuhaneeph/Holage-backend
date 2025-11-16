# System Settings Setup

This document explains how to set up the system settings table for managing configuration values like diesel rate.

## Database Setup

Run the SQL script to create the `system_settings` table:

```bash
mysql -u your_username -p holage_db < scripts/create_system_settings_table.sql
```

Or execute the SQL directly in your MySQL client:

```sql
USE holage_db;

CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description TEXT NULL,
    updatedBy INT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updatedBy) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default diesel rate
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('diesel_rate_per_liter', '1200', 'Diesel cost per liter in Naira (default: ₦1,200)')
ON DUPLICATE KEY UPDATE setting_value = '1200';
```

## Features

### Admin Dashboard
- Admins can view and update the diesel rate from the "Settings" tab in the admin dashboard
- The diesel rate is used in shipping cost calculations

### API Endpoints

**Public:**
- `GET /api/settings/diesel-rate` - Get current diesel rate (no authentication required)

**Admin Only:**
- `PUT /api/settings/diesel-rate/update` - Update diesel rate (requires admin authentication)
- `GET /api/settings/:key` - Get any system setting (requires admin authentication)
- `PUT /api/settings/:key` - Update any system setting (requires admin authentication)

## Usage

1. **View Current Diesel Rate:**
   - Navigate to Admin Dashboard → Settings tab
   - The current diesel rate is displayed

2. **Update Diesel Rate:**
   - Enter the new diesel rate in the input field
   - Click "Update Diesel Rate"
   - The new rate will be immediately used for all future shipping cost calculations

## Default Values

- **Diesel Rate:** ₦1,200 per liter (default)
- **Fuel Efficiency:** 3 km per liter (hardcoded in distanceCalculator.js)
- **Base Fee:** ₦10,000 (hardcoded in distanceCalculator.js)

## Notes

- The diesel rate is stored in the database and can be updated by admins
- All shipping cost calculations will use the current diesel rate from the database
- If the database query fails, the system falls back to the default value of ₦1,200

