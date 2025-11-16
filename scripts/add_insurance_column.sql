-- Add insurance column to shipments table
USE holage_db;

ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS insurance BOOLEAN DEFAULT FALSE;

