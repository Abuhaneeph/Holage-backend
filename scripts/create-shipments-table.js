import pool from "../config/db.js"

async function createShipmentsTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS shipments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shipperId INT NOT NULL,
        truckerId INT DEFAULT NULL,
        pickupState VARCHAR(100) NOT NULL,
        pickupLga VARCHAR(100) NULL,
        destinationState VARCHAR(100) NOT NULL,
        destinationLga VARCHAR(100) NULL,
        cargoType VARCHAR(100) NOT NULL,
        weight DECIMAL(10, 2) NOT NULL,
        truckType VARCHAR(100) NOT NULL,
        pickupDate DATE NOT NULL,
        fragileItems BOOLEAN DEFAULT FALSE,
        distance DECIMAL(10, 2) DEFAULT NULL,
        estimatedCost DECIMAL(10, 2) DEFAULT NULL,
        estimatedDuration VARCHAR(50) DEFAULT NULL,
        status ENUM('pending', 'assigned', 'in_transit', 'delivered', 'cancelled') DEFAULT 'pending',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        assignedAt TIMESTAMP DEFAULT NULL,
        deliveredAt TIMESTAMP DEFAULT NULL,
        FOREIGN KEY (shipperId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (truckerId) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_shipper (shipperId),
        INDEX idx_trucker (truckerId),
        INDEX idx_status (status),
        INDEX idx_created (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `

    await pool.execute(createTableQuery)
    console.log("✅ Shipments table created successfully!")
    
    // Show table structure
    const [columns] = await pool.execute("DESCRIBE shipments")
    console.log("\nTable structure:")
    console.table(columns)
    
    process.exit(0)
  } catch (error) {
    console.error("❌ Error creating shipments table:", error)
    process.exit(1)
  }
}

createShipmentsTable()

