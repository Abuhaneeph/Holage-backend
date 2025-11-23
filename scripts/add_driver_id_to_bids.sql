-- Add driverId column to shipment_bids table to track which driver the bid is for
ALTER TABLE shipment_bids 
ADD COLUMN IF NOT EXISTS driverId INT NULL,
ADD FOREIGN KEY (driverId) REFERENCES drivers(id) ON DELETE SET NULL,
ADD INDEX idx_driver (driverId);

