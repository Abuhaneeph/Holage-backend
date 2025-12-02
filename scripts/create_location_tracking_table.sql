-- Create location tracking table for GPS tracking
CREATE TABLE IF NOT EXISTS location_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shipmentId INT NOT NULL,
    userId INT NOT NULL, -- Driver/trucker ID
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(8, 2) NULL, -- GPS accuracy in meters
    speed DECIMAL(8, 2) NULL, -- Speed in km/h
    heading DECIMAL(5, 2) NULL, -- Direction in degrees (0-360)
    address TEXT NULL, -- Reverse geocoded address
    batteryLevel INT NULL, -- Device battery level (0-100)
    isActive TINYINT(1) DEFAULT 1, -- Whether this is the current active location
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shipmentId) REFERENCES shipments(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_shipmentId (shipmentId),
    INDEX idx_userId (userId),
    INDEX idx_isActive (isActive),
    INDEX idx_createdAt (createdAt),
    INDEX idx_location (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

