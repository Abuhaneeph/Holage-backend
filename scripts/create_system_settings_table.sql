-- Create system_settings table for storing configuration values
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

