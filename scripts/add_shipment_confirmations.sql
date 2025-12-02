-- Add pickup and delivery confirmation fields to shipments table
-- This allows shippers to confirm pickup and delivery before payments are released

ALTER TABLE shipments
ADD COLUMN pickupConfirmed TINYINT(1) DEFAULT 0 COMMENT 'Shipper confirmation that pickup has occurred',
ADD COLUMN deliveryConfirmed TINYINT(1) DEFAULT 0 COMMENT 'Shipper confirmation that delivery has occurred',
ADD COLUMN pickupConfirmedAt DATETIME NULL COMMENT 'Timestamp when pickup was confirmed',
ADD COLUMN deliveryConfirmedAt DATETIME NULL COMMENT 'Timestamp when delivery was confirmed';

-- Add index for faster queries on confirmation status
CREATE INDEX idx_pickup_confirmed ON shipments(pickupConfirmed);
CREATE INDEX idx_delivery_confirmed ON shipments(deliveryConfirmed);

