-- Update shipments table status ENUM to include new status values
-- This adds 'picking_up' and 'picked_up' statuses for the new shipment flow

ALTER TABLE shipments
MODIFY COLUMN status ENUM('pending', 'assigned', 'picking_up', 'picked_up', 'in_transit', 'delivered', 'cancelled') DEFAULT 'pending';

