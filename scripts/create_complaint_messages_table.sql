-- Create complaint_messages table for conversation threading
USE holage_db;

CREATE TABLE IF NOT EXISTS complaint_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaintId INT NOT NULL,
    senderId INT NOT NULL,
    senderRole VARCHAR(50) NOT NULL,
    senderName VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaintId) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_complaintId (complaintId),
    INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

