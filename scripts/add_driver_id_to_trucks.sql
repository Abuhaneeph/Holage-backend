-- Add driverId column to trucks table to link trucks to drivers
ALTER TABLE trucks 
ADD COLUMN IF NOT EXISTS driverId INT NULL,
ADD FOREIGN KEY (driverId) REFERENCES drivers(id) ON DELETE SET NULL,
ADD INDEX idx_driver (driverId);

