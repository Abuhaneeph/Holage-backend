-- Create notifications table for push notifications and in-app notifications
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info', -- 'info', 'success', 'warning', 'error', 'payment', 'shipment', 'bid'
    category VARCHAR(50) NOT NULL DEFAULT 'general', -- 'general', 'shipment', 'payment', 'bid', 'system'
    relatedId INT NULL, -- ID of related entity (shipmentId, bidId, transactionId, etc.)
    relatedType VARCHAR(50) NULL, -- 'shipment', 'bid', 'transaction', 'complaint', etc.
    isRead TINYINT(1) DEFAULT 0,
    readAt DATETIME NULL,
    actionUrl VARCHAR(500) NULL, -- URL to navigate when notification is clicked
    metadata JSON NULL, -- Additional data in JSON format
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_userId (userId),
    INDEX idx_isRead (isRead),
    INDEX idx_createdAt (createdAt),
    INDEX idx_type (type),
    INDEX idx_category (category),
    INDEX idx_related (relatedId, relatedType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

