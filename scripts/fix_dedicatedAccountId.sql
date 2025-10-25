-- Fix dedicatedAccountId column type
-- Change from INTEGER to VARCHAR to store Flutterwave's string IDs

ALTER TABLE users 
MODIFY COLUMN dedicatedAccountId VARCHAR(50) DEFAULT NULL;

-- This allows storing IDs like 'van_jV582yPd02' from Flutterwave


