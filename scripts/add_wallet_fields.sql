-- Add wallet-related fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS paystackCustomerCode VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS paystackCustomerId BIGINT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS walletAccountNumber VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS walletAccountName VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS walletBankName VARCHAR(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS walletBankSlug VARCHAR(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS walletBankId INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS walletActive BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS walletCurrency VARCHAR(10) DEFAULT 'NGN',
ADD COLUMN IF NOT EXISTS dedicatedAccountId BIGINT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bvn VARCHAR(20) DEFAULT NULL COMMENT 'Bank Verification Number';

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  reference VARCHAR(255) NOT NULL UNIQUE,
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'NGN',
  type ENUM('credit', 'debit') NOT NULL,
  status ENUM('success', 'failed', 'pending') DEFAULT 'pending',
  description TEXT,
  paystackReference VARCHAR(255) DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_userId (userId),
  INDEX idx_reference (reference),
  INDEX idx_createdAt (createdAt),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add indexes to users table for wallet fields
CREATE INDEX IF NOT EXISTS idx_paystackCustomerCode ON users(paystackCustomerCode);
CREATE INDEX IF NOT EXISTS idx_walletAccountNumber ON users(walletAccountNumber);

