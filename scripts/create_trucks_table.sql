-- Create trucks table for fleet managers
CREATE TABLE IF NOT EXISTS trucks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fleetManagerId INT NOT NULL,
    plateNumber VARCHAR(50) NOT NULL,
    vehicleType VARCHAR(100) NOT NULL,
    vehicleModel VARCHAR(100) NULL,
    vehicleYear INT NULL,
    capacity DECIMAL(10, 2) NULL COMMENT 'Capacity in tons',
    driverName VARCHAR(255) NULL,
    driverPhone VARCHAR(20) NULL,
    driverLicense VARCHAR(255) NULL,
    vehicleReg VARCHAR(255) NULL,
    status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (fleetManagerId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_fleetManager (fleetManagerId),
    INDEX idx_status (status),
    INDEX idx_plateNumber (plateNumber),
    UNIQUE KEY unique_plate_fleet (plateNumber, fleetManagerId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

