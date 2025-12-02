-- Create proof of delivery (POD) table for photos and signatures
CREATE TABLE IF NOT EXISTS pod_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shipmentId INT NOT NULL,
    userId INT NOT NULL, -- User who created the POD (driver/trucker)
    podType VARCHAR(50) NOT NULL, -- 'pickup' or 'delivery'
    photos JSON NULL, -- Array of photo URLs/paths
    signatureData TEXT NULL, -- Base64 encoded signature image
    signatureName VARCHAR(255) NULL, -- Name of person who signed
    signaturePhone VARCHAR(20) NULL, -- Phone of person who signed
    notes TEXT NULL, -- Additional notes
    latitude DECIMAL(10, 8) NULL, -- GPS coordinates
    longitude DECIMAL(11, 8) NULL,
    address TEXT NULL, -- Address where POD was captured
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (shipmentId) REFERENCES shipments(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_shipmentId (shipmentId),
    INDEX idx_userId (userId),
    INDEX idx_podType (podType),
    INDEX idx_createdAt (createdAt),
    UNIQUE KEY unique_shipment_pod (shipmentId, podType) -- One POD per type per shipment
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

