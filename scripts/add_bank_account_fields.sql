-- Add bank account fields for receiving payments (for truckers)
USE holage_db;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS bankAccountNumber VARCHAR(20) DEFAULT NULL COMMENT 'Bank account number for receiving payments',
ADD COLUMN IF NOT EXISTS bankCode VARCHAR(10) DEFAULT NULL COMMENT 'Bank code (e.g., 044 for Access Bank)',
ADD COLUMN IF NOT EXISTS bankName VARCHAR(100) DEFAULT NULL COMMENT 'Bank name';

CREATE INDEX IF NOT EXISTS idx_bankAccountNumber ON users(bankAccountNumber);

