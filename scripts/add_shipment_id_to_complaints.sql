-- Add shipmentId column to complaints table
-- This allows complaints to be linked to specific shipments

USE holage_db;

ALTER TABLE complaints
ADD COLUMN shipmentId INT NULL AFTER userId,
ADD INDEX idx_shipmentId (shipmentId),
ADD FOREIGN KEY (shipmentId) REFERENCES shipments(id) ON DELETE SET NULL;

